import Database from 'better-sqlite3';
import 'dotenv/config';

const DB_PATH = process.env.DB_PATH || './data/udcp.db';

const seedData = {
  devices: [
    {
      id: 'esp32-01',
      name: 'ESP32-01 (Living Room)',
      platform: 'esp32',
      firmware: 'v5.0.0-beta1',
      first_seen: Date.now() - 86400000,
      last_seen: Date.now(),
      status: 'online',
      metadata: JSON.stringify({ location: 'living_room', battery: 87, rssi: -45 })
    },
    {
      id: 'esp32-02',
      name: 'ESP32-02 (Kitchen)',
      platform: 'esp32',
      firmware: 'v5.0.0-beta1',
      first_seen: Date.now() - 172800000,
      last_seen: Date.now() - 30000,
      status: 'degraded',
      metadata: JSON.stringify({ location: 'kitchen', battery: 62, rssi: -68 })
    },
    {
      id: 'esp32-03',
      name: 'ESP32-03 (Garage)',
      platform: 'esp32',
      firmware: 'v5.0.0-beta1',
      first_seen: Date.now() - 259200000,
      last_seen: Date.now() - 120000,
      status: 'offline',
      metadata: JSON.stringify({ location: 'garage', battery: 41, rssi: -82 })
    }
  ],
  commands: [
    {
      device_id: 'esp32-01',
      command: 'led',
      payload: JSON.stringify({ state: true }),
      sent_at: Date.now() - 60000,
      delivered_at: Date.now() - 59000,
      executed_at: Date.now() - 58500,
      confirmed_at: Date.now() - 58000,
      status: 'confirmed'
    }
  ]
};

async function seed() {
  console.log('🌱 [SEED] Inserting test data...');
  const db = new Database(DB_PATH);
  
  const insertDevice = db.prepare(`
    INSERT OR REPLACE INTO devices (id, name, platform, firmware, first_seen, last_seen, status, metadata)
    VALUES (@id, @name, @platform, @firmware, @first_seen, @last_seen, @status, @metadata)
  `);
  
  const insertCommand = db.prepare(`
    INSERT INTO commands (device_id, command, payload, sent_at, delivered_at, executed_at, confirmed_at, status)
    VALUES (@device_id, @command, @payload, @sent_at, @delivered_at, @executed_at, @confirmed_at, @status)
  `);
  
  const tx = db.transaction(() => {
    for (const d of seedData.devices) {
      insertDevice.run(d);
    }
    for (const c of seedData.commands) {
      insertCommand.run(c);
    }
  });
  
  tx();
  db.close();
  console.log('✅ [SEED] Done');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});