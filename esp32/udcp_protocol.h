#ifndef UDCP_PROTOCOL_H
#define UDCP_PROTOCOL_H

#include "udcp_memory.h"
#include <mbedtls/md.h>
#include <ArduinoJson.h>

// ══════════════════════════════════════════════════════════════
// PROTOCOL DEFINITIONS
// ══════════════════════════════════════════════════════════════

enum QoS : uint8_t { QOS_FIRE = 0, QOS_ACK = 1, QOS_EXACTLY_ONCE = 2 };
enum MsgType : uint8_t { TYPE_EVENT, TYPE_COMMAND, TYPE_STATE, TYPE_STREAM, TYPE_ACK, TYPE_ERROR, TYPE_HELLO };
enum Transport : uint8_t { TRANS_UDP = 0x01, TRANS_WS = 0x02, TRANS_HTTP = 0x04 };

// ──────────────────────────────────────────────────────────────
// Binary Motion Frame (Zero-Copy Telemetry)
// ──────────────────────────────────────────────────────────────
struct __attribute__((packed)) MotionFrame {
  uint8_t version = 2;         // Frame version
  uint8_t type = TYPE_STREAM;
  uint16_t seq;
  uint32_t ts;
  float ax, ay, az;
  float gx, gy, gz;
  uint32_t crc32;
};

// ──────────────────────────────────────────────────────────────
// Replay Cache Entry
// ──────────────────────────────────────────────────────────────
struct ReplayEntry {
  char key[48];
  uint32_t ts;
  bool used;
};

// ──────────────────────────────────────────────────────────────
// ACK State Machine
// ──────────────────────────────────────────────────────────────
enum AckState : uint8_t { ACK_NONE, ACK_SENT, ACK_RECEIVED, ACK_COMMITTED };

struct PendingAck {
  char msgId[BUF_SIZE_ID];
  char streamId[BUF_SIZE_ID];
  uint32_t seq;
  uint8_t qos;
  uint8_t retries;
  uint32_t sentAt;
  uint32_t nextRetryAt;
  AckState state;
  Transport transport;
  bool active;
};

// ──────────────────────────────────────────────────────────────
// HMAC Builder
// ──────────────────────────────────────────────────────────────
class HmacBuilder {
private:
  const char* secret;
  char canonical[BUF_SIZE_CANONICAL];
  
public:
  HmacBuilder(const char* s) : secret(s) { canonical[0] = '\0'; }
  
  void build(uint8_t v, const char* msgId, uint32_t ts, const char* type, const char* name,
             uint32_t seq, const char* streamId, uint8_t qos, const char* routes,
             const char* authId, const char* nonce, uint32_t authTs, uint32_t exp) {
    safe_printf(canonical, sizeof(canonical), "%u|%s|%u|%s|%s|%u|%s|%u|%s|%s|%s|%u|%u",
                v, msgId, ts, type, name, seq, streamId, qos, routes, authId, nonce, authTs, exp);
  }
  
  void sign(char* outHex, size_t outSize) {
    uint8_t hash[32];
    mbedtls_md_context_t ctx;
    mbedtls_md_init(&ctx);
    mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
    mbedtls_md_hmac_starts(&ctx, (const unsigned char*)secret, strlen(secret));
    mbedtls_md_hmac_update(&ctx, (const unsigned char*)canonical, strlen(canonical));
    mbedtls_md_hmac_finish(&ctx, hash);
    mbedtls_md_free(&ctx);
    
    for (int i = 0; i < 32 && (i*2+1) < outSize; i++)
      sprintf(outHex + i*2, "%02x", hash[i]);
    outHex[64] = '\0';
  }
};

// ──────────────────────────────────────────────────────────────
// Route Utilities
// ──────────────────────────────────────────────────────────────
inline void sortRoutes(const char* routes[4], uint8_t& count) {
  for (uint8_t i = 0; i < count - 1; i++)
    for (uint8_t j = 0; j < count - i - 1; j++)
      if (strcmp(routes[j], routes[j+1]) > 0) {
        const char* tmp = routes[j];
        routes[j] = routes[j+1];
        routes[j+1] = tmp;
      }
}

inline void joinRoutes(const char* routes[4], uint8_t count, char* out, size_t outSize) {
  out[0] = '\0';
  for (uint8_t i = 0; i < count; i++) {
    if (i > 0) safe_cat(out, outSize, ",");
    safe_cat(out, outSize, routes[i]);
  }
}

inline void parseRoutes(const char* str, const char* routes[4], uint8_t& count) {
  char tmp[BUF_SIZE_ROUTE];
  safe_copy(tmp, sizeof(tmp), str);
  count = 0;
  char* tok = strtok(tmp, ",");
  while (tok && count < 4) {
    routes[count++] = tok;
    tok = strtok(nullptr, ",");
  }
}

#endif // UDCP_PROTOCOL_H