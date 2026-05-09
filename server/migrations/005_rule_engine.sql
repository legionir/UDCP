-- Rule Engine: flows + execution logs
CREATE TABLE IF NOT EXISTS rule_flows (
  rule_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  definition_json TEXT NOT NULL, -- { nodes:[], edges:[] }
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rule_device ON rule_flows(device_id);

CREATE TABLE IF NOT EXISTS rule_run_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  trigger_packet_msg_id TEXT,
  result TEXT NOT NULL, -- ok / error / condition_false
  details JSON,
  FOREIGN KEY(rule_id) REFERENCES rule_flows(rule_id) ON DELETE CASCADE,
  FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rule_run_rule ON rule_run_logs(rule_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_rule_run_device ON rule_run_logs(device_id, ts DESC);