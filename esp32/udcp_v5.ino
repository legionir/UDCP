#include "udcp_memory.h"
#include "udcp_protocol.h"
#include "udcp_stream.h"
#include "udcp_transport.h"
#include <time.h>

// ══════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* SERVER_HOST = "192.168.1.100";
const uint16_t UDP_PORT = 9000;
const uint16_t WS_PORT = 8080;
const uint16_t HTTP_PORT = 3000;
const char* DEVICE_ID = "esp32-01";
const char* AUTH_TOKEN = "secret-token";
const char* AUTH_SECRET = "shared-hmac-secret";

// ══════════════════════════════════════════════════════════════
// GLOBAL STATE (ALL STATIC - ZERO DYNAMIC ALLOCATION)
// ══════════════════════════════════════════════════════════════
MemStats g_memStats;
TransportManager g_transport(SERVER_HOST, UDP_PORT, WS_PORT, HTTP_PORT);
StreamManager g_streams;
HmacBuilder g_hmac(AUTH_SECRET);

// Static Buffers
char g_rxBuf[POOL_RX_SLOTS][BUF_SIZE_RX];
char g_txBuf[POOL_TX_SLOTS][BUF_SIZE_TX];
uint8_t g_rxHead = 0, g_txHead = 0;

// Static Documents
StaticJsonDocument<512> g_rxDoc;
StaticJsonDocument<512> g_txDoc;
StaticJsonDocument<256> g_ackDoc;

// Replay Cache
ReplayEntry g_replay[POOL_REPLAY_SLOTS];
uint8_t g_replayHead = 0;

// Pending Queue
RingBuffer<PendingAck, POOL_ACK_SLOTS> g_pending;

// Counters
uint32_t g_msgSeq = 0;
uint32_t g_nonceSeq = 0;

// Timers
uint32_t g_lastMotion = 0;
uint32_t g_lastHealth = 0;
uint32_t g_lastRetry = 0;

// ══════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════
void setupNTP() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  struct tm tm;
  for (int i = 0; i < 10; i++) {
    if (getLocalTime(&tm, 1000)) { Serial.println("[NTP] Synced"); return; }
    delay(500);
  }
  Serial.println("[NTP] Failed");
}

uint64_t epochMs() {
  struct timeval tv;
  gettimeofday(&tv, NULL);
  return (uint64_t)tv.tv_sec * 1000ULL + tv.tv_usec / 1000ULL;
}

void makeId(char* out, size_t outSize, const char* prefix) {
  safe_printf(out, outSize, "%s-%s-%llu-%u", prefix, DEVICE_ID, epochMs(), ++g_msgSeq);
}

void makeNonce(char* out, size_t outSize) {
  safe_printf(out, outSize, "n-%s-%llu-%08x-%u", DEVICE_ID, epochMs(), esp_random(), ++g_nonceSeq);
}

bool isReplay(const char* key) {
  for (uint8_t i = 0; i < POOL_REPLAY_SLOTS; i++)
    if (g_replay[i].used && strcmp(g_replay[i].key, key) == 0) return true;
  return false;
}

void markReplay(const char* key) {
  g_replay[g_replayHead].used = true;
  safe_copy(g_replay[g_replayHead].key, sizeof(g_replay[g_replayHead].key), key);
  g_replay[g_replayHead].ts = millis();
  g_replayHead = (g_replayHead + 1) % POOL_REPLAY_SLOTS;
}

// ══════════════════════════════════════════════════════════════
// PROTOCOL BUILDERS
// ══════════════════════════════════════════════════════════════
void buildMessage(JsonDocument& doc, const char* type, const char* name, QoS qos,
                  const char* streamId, uint32_t seq, const char* routes[4], uint8_t routeCount,
                  JsonObject& valueOut) {
  doc.clear();
  doc["v"] = 1;
  
  char msgId[BUF_SIZE_ID];
  makeId(msgId, sizeof(msgId), name);
  doc["msgId"] = msgId;
  doc["ts"] = epochMs();
  doc["type"] = type;
  doc["name"] = name;
  doc["seq"] = seq;
  doc["streamId"] = streamId;
  doc["qos"] = (uint8_t)qos;
  
  JsonArray r = doc.createNestedArray("route");
  for (uint8_t i = 0; i < routeCount; i++) r.add(routes[i]);
  
  char nonce[BUF_SIZE_NONCE];
  makeNonce(nonce, sizeof(nonce));
  uint64_t now = epochMs();
  
  JsonObject auth = doc.createNestedObject("auth");
  auth["id"] = DEVICE_ID;
  auth["token"] = AUTH_TOKEN;
  auth["nonce"] = nonce;
  auth["ts"] = now;
  auth["exp"] = now + 60000;
  
  JsonObject meta = doc.createNestedObject("meta");
  meta["deviceId"] = DEVICE_ID;
  meta["platform"] = "esp32";
  
  valueOut = doc.createNestedObject("value");
}

void signMessage(JsonDocument& doc) {
  JsonArray arr = doc["route"].as<JsonArray>();
  const char* routes[4];
  uint8_t count = 0;
  for (JsonVariant v : arr) if (count < 4) routes[count++] = v.as<const char*>();
  sortRoutes(routes, count);
  
  char routeStr[BUF_SIZE_ROUTE];
  joinRoutes(routes, count, routeStr, sizeof(routeStr));
  
  JsonObject auth = doc["auth"];
  g_hmac.build(doc["v"], doc["msgId"], doc["ts"], doc["type"], doc["name"],
               doc["seq"], doc["streamId"], doc["qos"], routeStr,
               auth["id"], auth["nonce"], auth["ts"], auth["exp"]);
  
  char sig[BUF_SIZE_HMAC];
  g_hmac.sign(sig, sizeof(sig));
  auth["sig"] = sig;
}

// ══════════════════════════════════════════════════════════════
// HANDLERS
// ══════════════════════════════════════════════════════════════
void handleIncoming(const char* data, size_t len) {
  g_rxDoc.clear();
  DeserializationError err = deserializeJson(g_rxDoc, data, len);
  if (err) return;
  
  if (!g_rxDoc.containsKey("msgId") || !g_rxDoc.containsKey("type")) return;
  
  // ACK handling
  if (strcmp(g_rxDoc["type"], "ack") == 0) {
    const char* ackFor = g_rxDoc["value"]["ackFor"];
    PendingAck p;
    while (g_pending.pop(p)) {
      if (strcmp(p.msgId, ackFor) == 0) {
        p.state = ACK_RECEIVED;
        break;
      } else {
        g_pending.push(p); // Put back
      }
    }
    return;
  }
  
  // Command handling
  if (strcmp(g_rxDoc["type"], "command") == 0 && strcmp(g_rxDoc["name"], "led") == 0) {
    bool state = g_rxDoc["value"]["state"] | false;
    digitalWrite(2, state ? HIGH : LOW);
    Serial.printf("[CMD] LED -> %s\n", state ? "ON" : "OFF");
  }
}

// ══════════════════════════════════════════════════════════════
// SEND OPERATIONS
// ══════════════════════════════════════════════════════════════
void sendMotion(float ax, float ay, float az, float gx, float gy, float gz) {
  const char* routes[] = {"udp"};
  StreamState* stream = g_streams.getOrCreate("motion-imu");
  stream->expectedSeq++;
  
  JsonObject val;
  buildMessage(g_txDoc, "stream", "motion", QOS_FIRE, "motion-imu", stream->expectedSeq, routes, 1, val);
  val["ax"] = ax; val["ay"] = ay; val["az"] = az;
  val["gx"] = gx; val["gy"] = gy; val["gz"] = gz;
  signMessage(g_txDoc);
  
  char* buf = g_txBuf[g_txHead];
  size_t len = serializeJson(g_txDoc, buf, BUF_SIZE_TX);
  g_txHead = (g_txHead + 1) % POOL_TX_SLOTS;
  
  g_transport.sendVia(buf, len, TRANS_UDP, AUTH_TOKEN);
}

void sendHello() {
  const char* routes[] = {"ws", "http"};
  JsonObject val;
  buildMessage(g_txDoc, "hello", "device", QOS_ACK, "hello-stream", 1, routes, 2, val);
  val["deviceId"] = DEVICE_ID;
  val["transport"] = "udp+ws+http";
  signMessage(g_txDoc);
  
  char* buf = g_txBuf[g_txHead];
  size_t len = serializeJson(g_txDoc, buf, BUF_SIZE_TX);
  g_txHead = (g_txHead + 1) % POOL_TX_SLOTS;
  
  g_transport.sendVia(buf, len, TRANS_WS | TRANS_HTTP, AUTH_TOKEN);
}

// ══════════════════════════════════════════════════════════════
// SCHEDULER TICKS
// ══════════════════════════════════════════════════════════════
void tickNetwork() {
  g_transport.loop();
  char* buf = g_rxBuf[g_rxHead];
  int n = g_transport.receive(buf, BUF_SIZE_RX);
  if (n > 0) {
    g_rxHead = (g_rxHead + 1) % POOL_RX_SLOTS;
    handleIncoming(buf, n);
  }
}

void tickTelemetry() {
  uint32_t now = millis();
  if (now - g_lastMotion >= 20) { // 50Hz
    g_lastMotion = now;
    sendMotion(0.12, -0.24, 9.81, 0.01, 0.03, -0.02);
  }
}

void tickHealth() {
  uint32_t now = millis();
  if (now - g_lastHealth >= 5000) {
    g_lastHealth = now;
    g_memStats.update();
    g_transport.tick();
    
    Serial.printf("[MEM] Free:%u Min:%u Frag:%u%%\n", 
                  g_memStats.heapFree, g_memStats.heapMin, g_memStats.fragmentation);
    Serial.printf("[TRANS] UDP:%d WS:%d HTTP:%d\n",
                  g_transport.udpMetrics.score, g_transport.wsMetrics.score, g_transport.httpMetrics.score);
  }
}

void tickRetry() {
  uint32_t now = millis();
  if (now - g_lastRetry >= 500) {
    g_lastRetry = now;
    // Retry logic for QoS>0 (simplified - needs full state machine)
  }
}

void tickStreams() {
  g_streams.tick(millis());
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  digitalWrite(2, LOW);
  
  // Initialize replay cache
  for (uint8_t i = 0; i < POOL_REPLAY_SLOTS; i++) g_replay[i].used = false;
  
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(300);
  Serial.println("[WIFI] Connected");
  
  setupNTP();
  g_transport.begin();
  
  delay(1000);
  sendHello();
  
  Serial.println("[UDCP] v5 Ready - Zero Allocation Mode");
}

void loop() {
  tickNetwork();
  tickTelemetry();
  tickStreams();
  tickHealth();
  tickRetry();
  
  // Deterministic timing
  delayMicroseconds(100);
}