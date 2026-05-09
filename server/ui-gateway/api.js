import express from 'express';
import { randomUUID } from 'crypto';
import { eventBus } from './events.js';

// این فایل قبلاً Phase 0 داشت؛ در اینجا endpoints Phase 2 اضافه می‌شود:

export function apiRouter(db, eventBusRef) {
  const router = express.Router();
  
  // ──────────────────────────────────────────────────────────────
  // EXISTING (Phase 0)
  // ──────────────────────────────────────────────────────────────
  router.get('/devices', (req, res) => {
    const rows = db.prepare('SELECT * FROM devices ORDER BY last_seen DESC').all();
    res.json(rows);
  });
  
  router.get('/devices/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
  
  router.get('/packets', (req, res) => {
    const { deviceId, streamId, transport, type, limit = 200 } = req.query;
    let sql = 'SELECT * FROM packets WHERE 1=1';
    const params = [];
    if (deviceId) { sql += ' AND device_id = ?'; params.push(deviceId); }
    if (streamId) { sql += ' AND stream_id = ?'; params.push(streamId); }
    if (transport) { sql += ' AND transport = ?'; params.push(transport); }
    if (type) { sql += ' AND type = ?'; params.push(type); }
    sql += ' ORDER BY received_at DESC LIMIT ?';
    params.push(Number(limit));
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  });
  
  router.get('/packets/export', (req, res) => {
    const { deviceId, streamId, transport, type } = req.query;
    let sql = 'SELECT * FROM packets WHERE 1=1';
    const params = [];
    if (deviceId) { sql += ' AND device_id = ?'; params.push(deviceId); }
    if (streamId) { sql += ' AND stream_id = ?'; params.push(streamId); }
    if (transport) { sql += ' AND transport = ?'; params.push(transport); }
    if (type) { sql += ' AND type = ?'; params.push(type); }
    sql += ' ORDER BY received_at ASC';
    const rows = db.prepare(sql).all(...params);
    
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    if (format === 'csv') {
      const header = ['id','device_id','msg_id','stream_id','type','name','seq','qos','transport','size','received_at','rtt_ms','status'];
      const csvRows = [header.join(',')];
      for (const r of rows) {
        csvRows.push([
          r.id, r.device_id, r.msg_id, r.stream_id, r.type, r.name, r.seq, r.qos, r.transport, r.size, r.received_at, r.rtt_ms ?? '', r.status
        ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="packets_${Date.now()}.csv"`);
      return res.send(csvRows.join('\n'));
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="packets_${Date.now()}.json"`);
      return res.send(JSON.stringify(rows, null, 2));
    }
  });
  
  router.get('/metrics/transport/:deviceId', (req, res) => {
    const { duration = '5m' } = req.query;
    let windowMs = 5 * 60 * 1000;
    if (duration === '15m') windowMs = 15 * 60 * 1000;
    if (duration === '1h') windowMs = 60 * 60 * 1000;
    
    const since = Date.now() - windowMs;
    const rows = db.prepare(`
      SELECT * FROM transport_metrics 
      WHERE device_id = ? AND ts >= ?
      ORDER BY ts ASC
    `).all(req.params.deviceId, since);
    
    res.json(rows);
  });
  
  router.get('/metrics/transport/:deviceId/latest', (req, res) => {
    const rows = db.prepare(`
      SELECT * FROM transport_metrics 
      WHERE device_id = ? 
      ORDER BY ts DESC LIMIT 3
    `).all(req.params.deviceId);
    
    // Group by transport
    const latest = {};
    for (const r of rows) {
      latest[r.transport] = r;
    }
    res.json(latest);
  });
  
  router.post('/commands/:deviceId', (req, res) => {
    const { command, payload, qos = 2 } = req.body;
    const sentAt = Date.now();
    const stmt = db.prepare(`
      INSERT INTO commands (device_id, command, payload, sent_at, status)
      VALUES (?, ?, ?, ?, 'sent')
    `);
    const info = stmt.run(req.params.deviceId, command, JSON.stringify(payload || {}), sentAt);
    
    const cmd = {
      id: info.lastInsertRowid,
      device_id: req.params.deviceId,
      command,
      payload: payload || {},
      sent_at: sentAt,
      status: 'sent'
    };
    
    eventBusRef.publishCommandUpdate(cmd);
    res.json(cmd);
  });
  
  router.get('/commands/:deviceId/history', (req, res) => {
    const rows = db.prepare(`
      SELECT * FROM commands WHERE device_id = ? ORDER BY sent_at DESC LIMIT 100
    `).all(req.params.deviceId);
    res.json(rows);
  });
  
  // ──────────────────────────────────────────────────────────────
  // 🆕 PHASE 2: REPLAY SESSIONS
  // ──────────────────────────────────────────────────────────────
  
  // Create replay session
  router.post('/replay/sessions', (req, res) => {
    const { name, deviceId, startTime, endTime, metadata } = req.body;
    if (!name || !deviceId || !startTime || !endTime) {
      return res.status(400).json({ error: 'name, deviceId, startTime, endTime are required' });
    }
    
    const id = randomUUID();
    const durationMs = Math.max(0, endTime - startTime);
    
    // Count packets in window
    const countRow = db.prepare(`
      SELECT COUNT(*) as c FROM packets 
      WHERE device_id = ? AND received_at >= ? AND received_at <= ?
    `).get(deviceId, startTime, endTime);
    const packetCount = countRow.c;
    
    db.prepare(`
      INSERT INTO replay_sessions (id, name, device_id, start_time, end_time, created_at, duration_ms, packet_count, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, deviceId, startTime, endTime, Date.now(), durationMs, packetCount, JSON.stringify(metadata || {}));
    
    res.json({ id, name, deviceId, startTime, endTime, durationMs, packetCount });
  });
  
  // Get replay session info
  router.get('/replay/sessions/:id', (req, res) => {
    const session = db.prepare('SELECT * FROM replay_sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Not found' });
    
    // Get packets in session
    const packets = db.prepare(`
      SELECT * FROM replay_packets WHERE session_id = ? ORDER BY timestamp ASC
    `).all(req.params.id);
    
    res.json({ ...session, packets: packets || [] });
  });
  
  // List all replay sessions
  router.get('/replay/sessions', (req, res) => {
    const { deviceId } = req.query;
    let sql = 'SELECT * FROM replay_sessions';
    const params = [];
    if (deviceId) { sql += ' WHERE device_id = ?'; params.push(deviceId); }
    sql += ' ORDER BY created_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  });
  
  // Export replay session (JSON)
  router.get('/replay/sessions/:id/export', (req, res) => {
    const session = db.prepare('SELECT * FROM replay_sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Not found' });
    
    const packets = db.prepare(`
      SELECT * FROM replay_packets WHERE session_id = ? ORDER BY timestamp ASC
    `).all(req.params.id);
    
    const payload = {
      session,
      packets,
      exportedAt: Date.now()
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="replay_${session.id}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  });
  
  // ──────────────────────────────────────────────────────────────
  // 🆕 PHASE 2: MEMORY METRICS (ESP32)
  // ──────────────────────────────────────────────────────────────
  
  // Receive memory metrics from device (ESP32 POST)
  router.post('/memory/:deviceId', (req, res) => {
    const {
      free_heap_kb, min_heap_kb, fragmentation_pct,
      largest_free_block_kb, watchdog_near_trigger,
      tasks, queues
    } = req.body;
    
    if (typeof free_heap_kb !== 'number' || typeof min_heap_kb !== 'number' || typeof fragmentation_pct !== 'number') {
      return res.status(400).json({ error: 'free_heap_kb/min_heap_kb/fragmentation_pct required' });
    }
    
    const ts = Date.now();
    db.prepare(`
      INSERT INTO memory_metrics (device_id, ts, free_heap_kb, min_heap_kb, fragmentation_pct, largest_free_block_kb, watchdog_near_trigger, tasks, queues)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.deviceId,
      ts,
      free_heap_kb,
      min_heap_kb,
      fragmentation_pct,
      largest_free_block_kb ?? null,
      watchdog_near_trigger ? 1 : 0,
      tasks ? JSON.stringify(tasks) : null,
      queues ? JSON.stringify(queues) : null
    );
    
    // Publish realtime
    eventBusRef.publishMetric({
      deviceId: req.params.deviceId,
      ts,
      type: 'memory',
      free_heap_kb, min_heap_kb, fragmentation_pct,
      largest_free_block_kb, watchdog_near_trigger: !!watchdog_near_trigger,
      tasks, queues
    });
    
    res.json({ ok: true, ts });
  });
  
  // Get memory metrics history
  router.get('/memory/:deviceId/history', (req, res) => {
    const { duration = '5m' } = req.query;
    let windowMs = 5 * 60 * 1000;
    if (duration === '15m') windowMs = 15 * 60 * 1000;
    if (duration === '1h') windowMs = 60 * 60 * 1000;
    
    const since = Date.now() - windowMs;
    const rows = db.prepare(`
      SELECT * FROM memory_metrics 
      WHERE device_id = ? AND ts >= ?
      ORDER BY ts ASC
    `).all(req.params.deviceId, since);
    
    res.json(rows);
  });
  
  // Get latest memory metrics
  router.get('/memory/:deviceId/latest', (req, res) => {
    const row = db.prepare(`
      SELECT * FROM memory_metrics 
      WHERE device_id = ? 
      ORDER BY ts DESC LIMIT 1
    `).get(req.params.deviceId);
    res.json(row || null);
  });
  
  return router;
}

