#ifndef UDCP_TRANSPORT_H
#define UDCP_TRANSPORT_H

#include "udcp_protocol.h"
#include <WiFi.h>
#include <WiFiUdp.h>
#include <WebSocketsClient.h>
#include <HTTPClient.h>

// ══════════════════════════════════════════════════════════════
// TRANSPORT LAYER
// ══════════════════════════════════════════════════════════════

struct TransportMetrics {
  uint32_t sent;
  uint32_t received;
  uint32_t errors;
  uint32_t rttSum;
  uint32_t rttCount;
  uint32_t avgRtt;
  uint32_t lastRtt;
  int16_t score;
  uint32_t lastUpdate;
  
  void recordSuccess(uint32_t rtt) {
    sent++;
    if (rtt > 0) {
      rttSum += rtt;
      rttCount++;
      avgRtt = rttSum / rttCount;
      lastRtt = rtt;
    }
    score = min(100, score + 2);
    lastUpdate = millis();
  }
  
  void recordFailure() {
    errors++;
    score = max(0, score - 10);
    lastUpdate = millis();
  }
  
  void decay() {
    score = max(0, score - 1);
  }
  
  bool isHealthy() const { return score > 20; }
};

// ──────────────────────────────────────────────────────────────
// Transport Manager
// ──────────────────────────────────────────────────────────────
class TransportManager {
private:
  WiFiUDP udp;
  WebSocketsClient ws;
  const char* host;
  uint16_t udpPort, wsPort, httpPort;
  bool wsReady;
  
public:
  TransportMetrics udpMetrics = {0,0,0,0,0,0,0,100,0};
  TransportMetrics wsMetrics = {0,0,0,0,0,0,0,100,0};
  TransportMetrics httpMetrics = {0,0,0,0,0,0,0,100,0};
  
  TransportManager(const char* h, uint16_t up, uint16_t wp, uint16_t hp)
    : host(h), udpPort(up), wsPort(wp), httpPort(hp), wsReady(false) {}
  
  void begin() {
    udp.begin(udpPort);
    ws.begin(host, wsPort, "/");
    ws.onEvent([this](WStype_t type, uint8_t*, size_t) {
      if (type == WStype_CONNECTED) wsReady = true;
      else if (type == WStype_DISCONNECTED) wsReady = false;
    });
    ws.setReconnectInterval(2000);
  }
  
  void loop() { ws.loop(); }
  
  bool sendUdp(const char* data, size_t len) {
    if (len > 1100) return false;
    udp.beginPacket(host, udpPort);
    udp.write((const uint8_t*)data, len);
    bool ok = udp.endPacket();
    if (ok) udpMetrics.recordSuccess(0);
    else udpMetrics.recordFailure();
    return ok;
  }
  
  bool sendWs(const char* data, size_t len) {
    if (!wsReady) { wsMetrics.recordFailure(); return false; }
    ws.sendTXT((const uint8_t*)data, len);
    wsMetrics.recordSuccess(0);
    return true;
  }
  
  bool sendHttp(const char* data, size_t len, const char* token) {
    if (WiFi.status() != WL_CONNECTED) { httpMetrics.recordFailure(); return false; }
    HTTPClient http;
    char url[128];
    safe_printf(url, sizeof(url), "http://%s:%u/message", host, httpPort);
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-UDCP-Token", token);
    int code = http.POST((uint8_t*)data, len);
    http.end();
    if (code > 0 && code < 500) { httpMetrics.recordSuccess(0); return true; }
    httpMetrics.recordFailure();
    return false;
  }
  
  bool sendVia(const char* data, size_t len, uint8_t transportMask, const char* token) {
    bool sent = false;
    if ((transportMask & TRANS_UDP) && udpMetrics.isHealthy())
      sent |= sendUdp(data, len);
    if ((transportMask & TRANS_WS) && wsMetrics.isHealthy())
      sent |= sendWs(data, len);
    if ((transportMask & TRANS_HTTP) && httpMetrics.isHealthy())
      sent |= sendHttp(data, len, token);
    return sent;
  }
  
  int receive(char* buf, size_t bufSize) {
    int sz = udp.parsePacket();
    if (sz > 0 && sz < bufSize) {
      int n = udp.read((uint8_t*)buf, bufSize - 1);
      buf[n] = '\0';
      udpMetrics.received++;
      return n;
    }
    return 0;
  }
  
  void tick() {
    uint32_t now = millis();
    if (now % 5000 < 10) {
      udpMetrics.decay();
      wsMetrics.decay();
      httpMetrics.decay();
    }
  }
  
  Transport chooseBest(const char* name) {
    // Motion -> UDP, Commands -> WS, State -> HTTP
    if (strcmp(name, "motion") == 0 && udpMetrics.isHealthy()) return (Transport)TRANS_UDP;
    if (strcmp(name, "button") == 0 && wsMetrics.isHealthy()) return (Transport)TRANS_WS;
    if (wsMetrics.score >= udpMetrics.score && wsMetrics.score >= httpMetrics.score) return (Transport)TRANS_WS;
    if (udpMetrics.score >= httpMetrics.score) return (Transport)TRANS_UDP;
    return (Transport)TRANS_HTTP;
  }
};

#endif // UDCP_TRANSPORT_H