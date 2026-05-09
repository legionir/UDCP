-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT,
  platform TEXT,
  firmware TEXT,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  status TEXT DEFAULT 'offline',
  metadata JSON
);

-- Packets (UDCP messages)
CREATE TABLE IF NOT EXISTS packets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  msg_id TEXT UNIQUE NOT NULL,
  stream_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  seq INTEGER NOT NULL,
  qos INTEGER NOT NULL,
  transport TEXT NOT NULL,
  size INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  rtt_ms INTEGER,
  status TEXT NOT NULL,
  payload JSON,
  FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_packets_device ON packets(device_id);
CREATE INDEX IF NOT EXISTS idx_packets_stream ON packets(stream_id);
CREATE INDEX IF NOT EXISTS idx_packets_time ON packets(received_at);

-- Transport metrics (time-series)
CREATE TABLE IF NOT EXISTS transport_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  transport TEXT NOT NULL,
  ts INTEGER NOT NULL,
  rtt_avg REAL NOT NULL,
  rtt_p50 REAL NOT NULL,
  rtt_p95 REAL NOT NULL,
  rtt_p99 REAL NOT NULL,
  loss_rate REAL NOT NULL,
  jitter REAL NOT NULL,
  score INTEGER NOT NULL,
  FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metrics_device_time ON transport_metrics(device_id, ts);

-- Commands lifecycle
CREATE TABLE IF NOT EXISTS commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  command TEXT NOT NULL,
  payload JSON,
  sent_at INTEGER NOT NULL,
  delivered_at INTEGER,
  executed_at INTEGER,
  confirmed_at INTEGER,
  status TEXT NOT NULL,
  FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commands_device ON commands(device_id);
