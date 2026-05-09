
#include <WiFi.h>
#include <WiFiUdp.h>
#include <WebSocketsClient.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <mbedtls/md.h>
#include <time.h>
#include <vector>

// ──────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* SERVER_HOST = "192.168.1.100";
const uint16_t UDP_PORT = 9000;
const uint16_t WS_PORT  = 8080;
const uint16_t HTTP_PORT = 3000;

const char* DEVICE_ID = "esp32-01";
const char* AUTH_TOKEN = "secret-token";
const char* AUTH_SECRET = "shared-hmac-secret";

// ──────────────────────────────────────────────────────────────
// CONSTANTS & TYPES
// ──────────────────────────────────────────────────────────────
static const size_t JSON_CAPACITY = 2048;
static const size_t MAX_QUEUE = 32;
static const size_t MAX_REORDER = 16;
static const size_t MAX_REPLAY = 64;
static const size_t MAX_DEDUP = 128;
static const size_t UDP_SAFE = 1100;

enum QoS : uint8_t { QOS0 = 0, QOS1 = 1, QOS2 = 2 };
enum Transport : uint8_t { T_UDP = 1, T_WS = 2, T_HTTP = 4 };

struct RingBuffer {
  char items[MAX_QUEUE][JSON_CAPACITY];
  uint8_t head = 0, tail = 0, count = 0;
  bool push(const char* data) {
    if (count >= MAX_QUEUE) return false;
    strncpy(items[head], data, JSON_CAPACITY - 1);
    items[head][JSON_CAPACITY - 1] = '\0';
    head = (head + 1) % MAX_QUEUE;
    count++;
    return true;
  }
  bool pop(char* out) {
    if (count == 0) return false;
    strncpy(out, items[tail], JSON_CAPACITY);
    tail = (tail + 1) % MAX_QUEUE;
    count--;
    return true;
  }
};

struct ReplayEntry {
  char key[64] = {0};
  uint32_t ts = 0;
  bool used = false;
};

struct ReorderSlot {
  uint32_t seq = 0;
  char payload[JSON_CAPACITY] = {0};
  uint32_t arrivedAt = 0;
  bool filled = false;
};

struct TransportHealth {
  int score = 100;
  uint32_t rttMs = 0;
  uint32_t loss = 0;
  uint32_t success = 0;
  uint32_t lastUpdate = 0;
};

// ──────────────────────────────────────────────────────────────
// GLOBAL STATE
// ──────────────────────────────────────────────────────────────
WiFiUDP udp;
WebSocketsClient wsClient;
RingBuffer pendingQueue;
ReplayEntry replayCache[MAX_REPLAY];
uint8_t replayHead = 0;
ReorderSlot reorderBuf[MAX_REORDER];
TransportHealth healthUDP = {100,0,0,0,0}, healthWS = {100,0,0,0,0}, healthHTTP = {100,0,0,0,0};

StaticJsonDocument<JSON_CAPACITY> docPool;
char idBuf[64] = {0}, nonceBuf[64] = {0}, routeBuf[32] = {0};
uint32_t msgSeq = 0, nonceSeq = 0;
bool wsConnected = false;
uint32_t lastHealthUpdate = 0, lastMotionPush = 0, lastFlush = 0;

// ──────────────────────────────────────────────────────────────
// UTILS
// ──────────────────────────────────────────────────────────────
uint64_t epochMs() {
  struct timeval tv;
  gettimeofday(&tv, NULL);
  return (uint64_t)tv.tv_sec * 1000ULL + tv.tv_usec / 1000ULL;
}

void setupNTP() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  struct tm tm;
  for (int i = 0; i < 10; i++) {
    if (getLocalTime(&tm, 1000)) break;
    delay(500);
  }
}

String hmacSha256Hex(const String& key, const String& data) {
  uint8_t out[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)key.c_str(), key.length());
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)data.c_str(), data.length());
  mbedtls_md_hmac_finish(&ctx, out);
  mbedtls_md_free(&ctx);

  char hex[65]; hex[64] = '\0';
  for (int i = 0; i < 32; i++) sprintf(hex + i*2, "%02x", out[i]);
  return String(hex);
}

String canonicalRoute(const char* routes) {
  // routes format: "udp,ws,http" -> sort -> "http,udp,ws"
  char tmp[64]; strncpy(tmp, routes, 63); tmp[63] = '\0';
  char* parts[8]; int n = 0;
  char* p = strtok(tmp, ",");
  while (p && n < 8) { parts[n++] = p; p = strtok(NULL, ","); }
  // Bubble sort (small N)
  for (int i = 0; i < n-1; i++)
    for (int j = 0; j < n-i-1; j++)
      if (strcmp(parts[j], parts[j+1]) > 0) { char* t = parts[j]; parts[j] = parts[j+1]; parts[j+1] = t; }
  String out;
  for (int i = 0; i < n; i++) { if (i) out += ","; out += parts[i]; }
  return out;
}

String makeId(const char* prefix) {
  msgSeq++;
  snprintf(idBuf, sizeof(idBuf), "%s-%s-%lu-%u", prefix, DEVICE_ID, epochMs(), msgSeq);
  return String(idBuf);
}

String makeNonce() {
  nonceSeq++;
  snprintf(nonceBuf, sizeof(nonceBuf), "n-%s-%lu-%08x%08x-%u", DEVICE_ID, epochMs(), esp_random(), esp_random(), nonceSeq);
  return String(nonceBuf);
}

bool isReplay(const String& key) {
  for (uint8_t i = 0; i < MAX_REPLAY; i++) {
    if (replayCache[i].used && strcmp(replayCache[i].key, key.c_str()) == 0) return true;
  }
  return false;
}

void markReplay(const String& key) {
  replayCache[replayHead].used = true;
  strncpy(replayCache[replayHead].key, key.c_str(), 63);
  replayCache[replayHead].key[63] = '\0';
  replayCache[replayHead].ts = epochMs();
  replayHead = (replayHead + 1) % MAX_REPLAY;
}

void updateHealth(TransportHealth& h, bool success, uint32_t rtt = 0) {
  if (success) { h.score = min(100, h.score + 2); h.success++; }
  else { h.score = max(0, h.score - 10); h.loss++; }
  if (rtt) h.rttMs = (h.rttMs * 3 + rtt) / 4; // EWMA
  h.lastUpdate = epochMs();
}

// ──────────────────────────────────────────────────────────────
// PROTOCOL BUILDERS
// ──────────────────────────────────────────────────────────────
void buildBase(JsonDocument& doc, const char* type, const char* name, QoS qos, const char* stream, uint32_t seq, const char* routes) {
  doc.clear();
  doc["v"] = 1;
  doc["msgId"] = makeId(name);
  doc["ts"] = epochMs();
  doc["type"] = type;
  doc["name"] = name;
  doc["seq"] = seq;
  doc["streamId"] = stream;
  doc["qos"] = (uint8_t)qos;
  
  JsonArray r = doc.createNestedArray("route");
  char tmp[64]; strncpy(tmp, routes, 63); tmp[63] = '\0';
  char* p = strtok(tmp, ",");
  while (p) { r.add(p); p = strtok(NULL, ","); }

  JsonObject auth = doc.createNestedObject("auth");
  auth["id"] = DEVICE_ID;
  auth["token"] = AUTH_TOKEN;
  auth["nonce"] = makeNonce();
  auth["ts"] = epochMs();
  auth["exp"] = epochMs() + 60000;
  auth["scope"] = stream;

  JsonObject meta = doc.createNestedObject("meta");
  meta["deviceId"] = DEVICE_ID;
  meta["platform"] = "esp32";
}

void signDoc(JsonDocument& doc) {
  // Canonical string for HMAC
  String base;
  base.reserve(512);
  base += String(doc["v"] | 1) + "|";
  base += doc["msgId"].as<String>() + "|";
  base += String(doc["ts"] | 0) + "|";
  base += doc["type"].as<String>() + "|";
  base += doc["name"].as<String>() + "|";
  base += String(doc["seq"] | 0) + "|";
  base += doc["streamId"].as<String>() + "|";
  base += String(doc["qos"] | 0) + "|";
  
  // Sort routes
  JsonArray arr = doc["route"].as<JsonArray>();
  std::vector<String> routes;
  for (JsonVariant v : arr) routes.push_back(v.as<String>());
  sort(routes.begin(), routes.end());
  for (size_t i = 0; i < routes.size(); i++) {
    if (i) base += ",";
    base += routes[i];
  }
  
  JsonObject auth = doc["auth"].as<JsonObject>();
  base += "|" + auth["id"].as<String>() + "|" + auth["nonce"].as<String>() + "|" + String(auth["ts"] | 0) + "|" + String(auth["exp"] | 0);
  
  doc["auth"]["sig"] = hmacSha256Hex(AUTH_SECRET, base);
}

// ──────────────────────────────────────────────────────────────
// TRANSPORT SENDERS
// ──────────────────────────────────────────────────────────────
void sendUdp(const String& payload) {
  if (payload.length() > UDP_SAFE) return;
  udp.beginPacket(SERVER_HOST, UDP_PORT);
  udp.print(payload);
  udp.endPacket();
}

void sendWs(const String& payload) {
  if (wsConnected) wsClient.sendTXT(payload);
}

void sendHttp(const String& payload) {
  HTTPClient http;
  http.begin(String("http://") + SERVER_HOST + ":" + HTTP_PORT + "/message");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-UDCP-Token", AUTH_TOKEN);
  int code = http.POST((uint8_t*)payload.c_str(), payload.length());
  http.end();
}

void sendVia(const String& payload, const char* routes) {
  char tmp[64]; strncpy(tmp, routes, 63); tmp[63] = '\0';
  char* p = strtok(tmp, ",");
  while (p) {
    if (strcmp(p, "udp") == 0 && healthUDP.score > 20) sendUdp(payload);
    else if (strcmp(p, "ws") == 0 && healthWS.score > 20) sendWs(payload);
    else if (strcmp(p, "http") == 0 && healthHTTP.score > 20) sendHttp(payload);
    p = strtok(NULL, ",");
  }
}

// ──────────────────────────────────────────────────────────────
// INCOMING & ACK
// ──────────────────────────────────────────────────────────────
void handleIncoming(const String& payload, const char* transport) {
  DeserializationError err = deserializeJson(docPool, payload);
  if (err) return;
  if (!docPool.containsKey("v") || !docPool.containsKey("msgId")) return;

  // Auth check
  if (docPool["auth"].is<JsonObject>()) {
    JsonObject a = docPool["auth"];
    if (a["token"] != AUTH_TOKEN) return;
    if (epochMs() > (uint32_t)(a["exp"] | 0)) return;
    String rKey = a["id"].as<String>() + ":" + a["nonce"].as<String>() + ":" + transport;
    if (isReplay(rKey)) return;
    markReplay(rKey);

    // Verify HMAC
    String base = String(docPool["v"]|1) + "|" + docPool["msgId"].as<String>() + "|" + 
                  String(docPool["ts"]|0) + "|" + docPool["type"].as<String>() + "|" + 
                  docPool["name"].as<String>() + "|" + String(docPool["seq"]|0) + "|" + 
                  docPool["streamId"].as<String>() + "|" + String(docPool["qos"]|0) + "|";
    JsonArray arr = docPool["route"].as<JsonArray>();
    std::vector<String> routes;
    for (JsonVariant v : arr) routes.push_back(v.as<String>());
    sort(routes.begin(), routes.end());
    for (size_t i=0;i<routes.size();i++){ if(i) base+=","; base+=routes[i]; }
    base += "|" + a["id"].as<String>() + "|" + a["nonce"].as<String>() + "|" + String(a["ts"]|0) + "|" + String(a["exp"]|0);
    
    if (a["sig"] != hmacSha256Hex(AUTH_SECRET, base)) return;
  }

  // ACK handling
  if (docPool["type"] == "ack") {
    uint32_t ackTs = docPool["ts"] | 0;
    uint32_t rtt = epochMs() - ackTs;
    if (strcmp(transport, "udp") == 0) updateHealth(healthUDP, true, rtt);
    else if (strcmp(transport, "ws") == 0) updateHealth(healthWS, true, rtt);
    else updateHealth(healthHTTP, true, rtt);
    return;
  }

  // Reorder buffer
  uint32_t seq = docPool["seq"] | 0;
  const char* sid = docPool["streamId"] | "";
  bool placed = false;
  for (uint8_t i=0; i<MAX_REORDER; i++) {
    if (reorderBuf[i].filled && reorderBuf[i].seq == seq && strcmp(sid, "error") != 0) { placed = true; break; }
  }
  if (!placed) {
    for (uint8_t i=0; i<MAX_REORDER; i++) {
      if (!reorderBuf[i].filled) {
        reorderBuf[i].seq = seq;
        reorderBuf[i].arrivedAt = epochMs();
        reorderBuf[i].filled = true;
        break;
      }
    }
  }

  // QoS > 0 -> ACK
  if ((uint8_t)(docPool["qos"]|0) > 0) {
    StaticJsonDocument<256> ack;
    ack["v"] = 1; ack["msgId"] = makeId("ack"); ack["ts"] = epochMs();
    ack["type"] = "ack"; ack["name"] = "ack"; ack["seq"] = 0;
    ack["streamId"] = sid;
    ack["value"]["ackFor"] = docPool["msgId"].as<String>();
    ack["value"]["status"] = "ok";
    ack["value"]["ackSeq"] = seq;
    ack["value"]["ackTs"] = epochMs();
    ack["value"]["streamId"] = sid;
    ack["qos"] = 0; ack["auth"] = nullptr; ack["meta"]["deviceId"] = DEVICE_ID;
    JsonArray r = ack.createNestedArray("route"); r.add(transport);
    String out; serializeJson(ack, out);
    if (strcmp(transport, "udp") == 0) sendUdp(out);
    else if (strcmp(transport, "ws") == 0) sendWs(out);
    else sendHttp(out);
  }
}

// ──────────────────────────────────────────────────────────────
// SETUP & LOOP
// ──────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  digitalWrite(2, LOW);
  setupNTP();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(300);
  udp.begin(UDP_PORT);
  wsClient.begin(SERVER_HOST, WS_PORT, "/");
  wsClient.onEvent([](WStype_t type, uint8_t* payload, size_t length) {
    if (type == WStype_CONNECTED) wsConnected = true;
    else if (type == WStype_DISCONNECTED) wsConnected = false;
    else if (type == WStype_TEXT) {
      String msg; msg.reserve(length+1);
      for (size_t i=0;i<length;i++) msg += (char)payload[i];
      handleIncoming(msg, "ws");
    }
  });
  wsClient.setReconnectInterval(2000);
}

void loop() {
  wsClient.loop();
  
  // UDP RX
  int sz = udp.parsePacket();
  if (sz > 0 && sz <= UDP_SAFE) {
    String msg; msg.reserve(sz+1);
    while (udp.available()) msg += (char)udp.read();
    handleIncoming(msg, "udp");
  }

  // Flush reorder
  uint32_t now = epochMs();
  for (uint8_t i=0; i<MAX_REORDER; i++) {
    if (reorderBuf[i].filled && now - reorderBuf[i].arrivedAt > 2000) {
      reorderBuf[i].filled = false;
    }
  }

  // Motion stream (50Hz -> 20ms)
  if (now - lastMotionPush > 20) {
    lastMotionPush = now;
    buildBase(docPool, "stream", "motion", QOS0, "motion-imu", 0, "udp");
    JsonObject v = docPool.createNestedObject("value");
    v["ax"] = 0.12; v["ay"] = -0.24; v["az"] = 9.81;
    v["gx"] = 0.01; v["gy"] = 0.03; v["gz"] = -0.02;
    signDoc(docPool);
    String out; serializeJson(docPool, out);
    sendVia(out, "udp");
  }

  // Health decay
  if (now - lastHealthUpdate > 5000) {
    lastHealthUpdate = now;
    healthUDP.score = max(0, healthUDP.score - 1);
    healthWS.score = max(0, healthWS.score - 1);
    healthHTTP.score = max(0, healthHTTP.score - 1);
  }
  delay(5);
}

---
