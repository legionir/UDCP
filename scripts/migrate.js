import Database from 'better-sqlite3';

const db = new Database('udcp.db');

db.exec(`
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  last_seen INTEGER
);

CREATE TABLE IF NOT EXISTS packets (
  id INTEGER PRIMARY KEY,
  device_id TEXT,
  msg_id TEXT,
  stream_id TEXT,
  type TEXT,
  name TEXT,
  seq INTEGER,
  qos INTEGER,
  transport TEXT,
  size INTEGER,
  received_at INTEGER,
  payload TEXT
);
`);

console.log('✅ migrated');
