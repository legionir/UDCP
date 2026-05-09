import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import { initDb } from './storage/sqlite.js';
import { udpServer } from './transport/udp.js';
import { wsServer } from './transport/ws.js';
import { httpApp } from './transport/http.js';
import { apiRouter } from './ui-gateway/api.js';
import { eventBus, initSse } from './ui-gateway/events.js';
import { metricsCollector } from './metrics/collector.js';
import { metricsExporter } from './metrics/exporter.js';

// ES modules __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ──────────────────────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  console.log('🚀 [UDCP v5] Starting server...');
  
  // 1. Initialize Database
  const db = await initDb();
  console.log('✅ [DB] SQLite initialized:', process.env.DB_PATH || './data/udcp.db');
  
  // 2. Setup Express + HTTP Server
  const app = express();
  app.use(express.json({ limit: '128kb' }));
  
  // CORS for dev (dashboard on :5173)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-UDCP-Token');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });
  
  // 3. Mount API + SSE
  app.use('/api', apiRouter(db, eventBus));
  initSse(app, eventBus);
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      version: '5.0.0',
      uptime: process.uptime(),
      timestamp: Date.now()
    });
  });
  
  const server = http.createServer(app);
  
  // 4. Start Transport Layers
  udpServer(server, db, eventBus); // UDP on server socket
  wsServer(server, db, eventBus);  // WS on same server
  httpApp(app, db, eventBus);     // HTTP handlers
  
  // 5. Start Metrics Collection
  metricsCollector(db, eventBus);
  metricsExporter(db);
  
  // 6. Listen
  server.listen(PORT, HOST, () => {
    console.log(`✅ [HTTP] Listening on http://${HOST}:${PORT}`);
    console.log(`✅ [WS]   Listening on ws://${HOST}:${process.env.WS_PORT || 8080}`);
    console.log(`✅ [UDP]  Listening on ${process.env.UDP_PORT || 9000}/udp`);
    console.log(`📡 [SSE]  /api/events`);
  });
  
  // Graceful shutdown
  const shutdown = () => {
    console.log('\n🛑 [SHUTDOWN] Closing server...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});