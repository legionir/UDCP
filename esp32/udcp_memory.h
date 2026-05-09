#ifndef UDCP_MEMORY_H
#define UDCP_MEMORY_H

#include <stdint.h>
#include <string.h>

// ══════════════════════════════════════════════════════════════
// MEMORY POOLS - ZERO RUNTIME ALLOCATION
// ══════════════════════════════════════════════════════════════

#define POOL_RX_SLOTS      8
#define POOL_TX_SLOTS      8
#define POOL_REORDER_SLOTS 32
#define POOL_REPLAY_SLOTS  64
#define POOL_STREAM_SLOTS  16
#define POOL_ACK_SLOTS     8

#define BUF_SIZE_RX        1024
#define BUF_SIZE_TX        1024
#define BUF_SIZE_REORDER   512
#define BUF_SIZE_CANONICAL 512
#define BUF_SIZE_HMAC      65
#define BUF_SIZE_ID        64
#define BUF_SIZE_NONCE     64
#define BUF_SIZE_ROUTE     32

// ──────────────────────────────────────────────────────────────
// Ring Buffer (Lock-Free for Single Producer/Consumer)
// ──────────────────────────────────────────────────────────────
template<typename T, size_t N>
struct RingBuffer {
  T items[N];
  volatile uint8_t head = 0;
  volatile uint8_t tail = 0;
  volatile uint8_t count = 0;
  
  bool push(const T& item) {
    if (count >= N) return false;
    items[head] = item;
    head = (head + 1) % N;
    __sync_synchronize();
    count++;
    return true;
  }
  
  bool pop(T& out) {
    if (count == 0) return false;
    out = items[tail];
    tail = (tail + 1) % N;
    __sync_synchronize();
    count--;
    return true;
  }
  
  bool peek(T& out) const {
    if (count == 0) return false;
    out = items[tail];
    return true;
  }
  
  void clear() { head = tail = count = 0; }
  bool isEmpty() const { return count == 0; }
  bool isFull() const { return count >= N; }
  uint8_t size() const { return count; }
};

// ──────────────────────────────────────────────────────────────
// Fixed String Buffer Utilities
// ──────────────────────────────────────────────────────────────
inline void safe_copy(char* dst, size_t dstSize, const char* src) {
  if (!dst || !src || dstSize == 0) return;
  strncpy(dst, src, dstSize - 1);
  dst[dstSize - 1] = '\0';
}

inline void safe_cat(char* dst, size_t dstSize, const char* src) {
  if (!dst || !src || dstSize == 0) return;
  size_t len = strlen(dst);
  if (len >= dstSize - 1) return;
  strncat(dst, src, dstSize - len - 1);
}

inline size_t safe_printf(char* dst, size_t dstSize, const char* fmt, ...) {
  if (!dst || dstSize == 0) return 0;
  va_list args;
  va_start(args, fmt);
  int n = vsnprintf(dst, dstSize, fmt, args);
  va_end(args);
  return (n > 0 && (size_t)n < dstSize) ? n : 0;
}

// ──────────────────────────────────────────────────────────────
// Memory Pool Statistics
// ──────────────────────────────────────────────────────────────
struct MemStats {
  uint32_t rxUsed = 0, rxPeak = 0;
  uint32_t txUsed = 0, txPeak = 0;
  uint32_t reorderUsed = 0, reorderPeak = 0;
  uint32_t heapFree = 0, heapMin = 0;
  uint32_t fragmentation = 0;
  
  void update() {
    heapFree = ESP.getFreeHeap();
    if (heapMin == 0 || heapFree < heapMin) heapMin = heapFree;
    size_t largestBlock = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);
    fragmentation = heapFree > 0 ? ((heapFree - largestBlock) * 100 / heapFree) : 0;
  }
};

extern MemStats g_memStats;

#endif // UDCP_MEMORY_H
