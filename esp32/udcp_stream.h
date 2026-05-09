#ifndef UDCP_STREAM_H
#define UDCP_STREAM_H

#include "udcp_protocol.h"

// ══════════════════════════════════════════════════════════════
// STREAM ORDERING & REORDER BUFFER
// ══════════════════════════════════════════════════════════════

struct ReorderSlot {
  uint32_t seq;
  char payload[BUF_SIZE_REORDER];
  uint32_t arrivedAt;
  bool filled;
};

struct StreamState {
  char streamId[BUF_SIZE_ID];
  uint32_t expectedSeq;
  uint32_t lastSeq;
  ReorderSlot slots[8];
  uint32_t lastFlush;
  bool active;
  
  void init(const char* sid) {
    safe_copy(streamId, sizeof(streamId), sid);
    expectedSeq = 0;
    lastSeq = 0;
    lastFlush = millis();
    active = true;
    for (uint8_t i = 0; i < 8; i++) slots[i].filled = false;
  }
  
  bool addToReorder(uint32_t seq, const char* data, uint32_t now) {
    for (uint8_t i = 0; i < 8; i++) {
      if (!slots[i].filled) {
        slots[i].seq = seq;
        safe_copy(slots[i].payload, sizeof(slots[i].payload), data);
        slots[i].arrivedAt = now;
        slots[i].filled = true;
        return true;
      }
    }
    return false; // Buffer full
  }
  
  bool flushOrdered(uint32_t now) {
    bool flushed = false;
    while (true) {
      bool found = false;
      for (uint8_t i = 0; i < 8; i++) {
        if (slots[i].filled && slots[i].seq == expectedSeq + 1) {
          expectedSeq = slots[i].seq;
          slots[i].filled = false;
          found = true;
          flushed = true;
          break;
        }
      }
      if (!found) break;
    }
    
    // Timeout old slots
    for (uint8_t i = 0; i < 8; i++) {
      if (slots[i].filled && (now - slots[i].arrivedAt > 2000)) {
        slots[i].filled = false;
      }
    }
    
    if (flushed) lastFlush = now;
    return flushed;
  }
  
  bool isOutOfOrder(uint32_t seq) const {
    return seq < expectedSeq;
  }
  
  bool isGap(uint32_t seq) const {
    return seq > expectedSeq + 1;
  }
  
  void markReceived(uint32_t seq) {
    if (seq == expectedSeq + 1) expectedSeq = seq;
    lastSeq = seq;
  }
};

// ──────────────────────────────────────────────────────────────
// Stream Manager
// ──────────────────────────────────────────────────────────────
class StreamManager {
private:
  StreamState streams[POOL_STREAM_SLOTS];
  uint8_t count;
  
public:
  StreamManager() : count(0) {}
  
  StreamState* find(const char* streamId) {
    for (uint8_t i = 0; i < count; i++)
      if (strcmp(streams[i].streamId, streamId) == 0 && streams[i].active)
        return &streams[i];
    return nullptr;
  }
  
  StreamState* getOrCreate(const char* streamId) {
    StreamState* s = find(streamId);
    if (s) return s;
    
    if (count >= POOL_STREAM_SLOTS) {
      // Evict oldest inactive
      uint32_t oldest = 0xFFFFFFFF;
      uint8_t idx = 0;
      for (uint8_t i = 0; i < count; i++) {
        if (!streams[i].active || streams[i].lastFlush < oldest) {
          oldest = streams[i].lastFlush;
          idx = i;
        }
      }
      streams[idx].init(streamId);
      return &streams[idx];
    }
    
    streams[count].init(streamId);
    return &streams[count++];
  }
  
  void tick(uint32_t now) {
    for (uint8_t i = 0; i < count; i++)
      if (streams[i].active)
        streams[i].flushOrdered(now);
  }
};

#endif // UDCP_STREAM_H
