import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || './data/udcp.db';

let dbInstance = null;

export async function initDb() {
  if (dbInstance) return dbInstance;
  
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  
  dbInstance = new Database(DB_PATH);
  dbInstance.pragma('journal_mode = WAL');
  
  // Run migrations (001, 002, 003)
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  
  const runTx = dbInstance.transaction(() => {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      dbInstance.exec(sql);
    }
  });
  runTx();
  
  // Prepared statements (replay)
  dbInstance.prepare(`
    INSERT INTO replay_sessions (id, name, device_id, start_time, end_time, created_at, duration_ms, packet_count, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run; // used in api.js
  
  dbInstance.prepare(`
    INSERT INTO replay_packets (session_id, original_msg_id, device_id, stream_id, type, name, seq, qos, transport, size, timestamp, rtt_ms, status, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run;
  
  dbInstance.prepare('SELECT * FROM replay_sessions WHERE id = ?').get;
  dbInstance.prepare('SELECT * FROM replay_packets WHERE session_id = ? ORDER BY timestamp ASC').all;
  dbInstance.prepare('SELECT * FROM replay_sessions ORDER BY created_at DESC').all;
  
  return dbInstance;
}

// Helpers exported for API
export function insertReplaySession(db, { id, name, deviceId, startTime, endTime, durationMs, packetCount, metadata }) {
  db.prepare(`
    INSERT INTO replay_sessions (id, name, device_id, start_time, end_time, created_at, duration_ms, packet_count, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, deviceId, startTime, endTime, Date.now(), durationMs, packetCount, JSON.stringify(metadata || {}));
}

export function insertReplayPacket(db, p) {
  db.prepare(`
    INSERT INTO replay_packets (session_id, original_msg_id, device_id, stream_id, type, name, seq, qos, transport, size, timestamp, rtt_ms, status, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    p.session_id, p.original_msg_id, p.device_id, p.stream_id, p.type, p.name, p.seq, p.qos,
    p.transport, p.size, p.timestamp, p.rtt_ms ?? null, p.status, JSON.stringify(p.payload)
  );
}

export function getReplaySession(db, id) {
  const session = db.prepare('SELECT * FROM replay_sessions WHERE id = ?').get(id);
  if (!session) return null;
  const packets = db.prepare('SELECT * FROM replay_packets WHERE session_id = ? ORDER BY timestamp ASC').all(id);
  return { ...session, packets };
}
