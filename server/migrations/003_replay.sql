-- Replay Sessions (Time Travel)
CREATE TABLE IF NOT EXISTS replay_sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  device_id TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  packet_count INTEGER NOT NULL DEFAULT 0,
  metadata JSON,
  FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_replay_device_time ON replay_sessions(device_id, start_time);

-- Replay Packets (recorded subset of packets in session window)
CREATE TABLE IF NOT EXISTS replay_packets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  original_msg_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  stream_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  seq INTEGER NOT NULL,
  qos INTEGER NOT NULL,
  transport TEXT NOT NULL,
  size INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  rtt_ms INTEGER,
  status TEXT NOT NULL,
  payload JSON,
  FOREIGN KEY(session_id) REFERENCES replay_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_replay_packets_session ON replay_packets(session_id);
CREATE INDEX IF NOT EXISTS idx_replay_packets_time ON replay_packets(timestamp);

-- Embedded Memory Metrics (ESP32)
CREATE TABLE IF NOT EXISTS memory_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  free_heap_kb REAL NOT NULL,
  min_heap_kb REAL NOT NULL,
  fragmentation_pct REAL NOT NULL,
  largest_free_block_kb REAL,
  watchdog_near_trigger INTEGER DEFAULT 0,
  tasks JSON,
  queues JSON,
  FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_device_time ON memory_metrics(device_id, ts);

---

### 🖥️ Backend - کدهای جدید/به‌روزرسانی‌شده