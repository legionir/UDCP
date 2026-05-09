import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || './data/udcp.db';

async function migrate() {
  console.log('🔧 [MIGRATE] Initializing database:', DB_PATH);
  
  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  
  // Read migrations
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  console.log(`📦 Found ${files.length} migration(s)`);
  
  const run = db.transaction(() => {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      console.log(`   → Running ${file}`);
      db.exec(sql);
    }
  });
  
  run();
  db.close();
  console.log('✅ [MIGRATE] Done');
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
