import express from 'express';
import { randomUUID } from 'crypto';
import { eventBus } from './events.js';
import { validateMessage, buildAck, buildError } from '../core/protocol.js';
import { verifyAuth } from '../core/hmac.js';

const AUTH_SECRET = process.env.AUTH_SECRET || 'shared-hmac-secret';

export function apiRouter(db, eventBusRef) {
  const router = express.Router();
  
  // ──────────────────────────────────────────────────────────────
  // (Phase 0) EXISTING ENDPOINTS
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
    const latest = {};
    for (const r of rows) latest[r.transport] = r;
    res.json(latest);
  });
  
  // ──────────────────────────────────────────────────────────────
  // 🆕 PHASE 3: COMMANDS (Lifecycle)
  // ──────────────────────────────────────────────────────────────
  
  // Send command (QoS=2) -> insert command with status='sent'
  router.post('/commands/:deviceId', (req, res) => {
    const { command, payload, qos = 2, preferredTransport = ['ws','http'] } = req.body;
    const deviceId = req.params.deviceId;
    const sentAt = Date.now();
    
    const msgId = `cmd-${sentAt}-${Math.random().toString(16).slice(2,8)}`;
    
    const stmt = db.prepare(`
      INSERT INTO commands 
      (device_id, command, payload, sent_at, status, preferred_transport, qos)
      VALUES (?, ?, ?, ?, 'sent', ?, ?)
    `);
    const info = stmt.run(deviceId, command, JSON.stringify(payload || {}), sentAt, JSON.stringify(preferredTransport || ['ws','http']), qos);
    
    const cmd = {
      id: info.lastInsertRowid,
      device_id: deviceId,
      command,
      payload: payload || {},
      sent_at: sentAt,
      status: 'sent',
      preferred_transport: preferredTransport || ['ws','http'],
      qos: qos,
      msg_id: msgId
    };
    
    // Publish realtime: command:update + command:${deviceId}
    eventBusRef.publishCommandUpdate(cmd);
    
    // TODO: در transport layer (ws/http/udp) باید پیام command با این msgId ارسال شود.
    // اینجا فقط رکورد می‌سازیم و event می‌فرستیم.
    res.json(cmd);
  });
  
  // Get command history for a device
  router.get('/commands/:deviceId/history', (req, res) => {
    const rows = db.prepare(`
      SELECT * FROM commands WHERE device_id = ? ORDER BY sent_at DESC LIMIT 200
    `).all(req.params.deviceId);
    res.json(rows);
  });
  
  // Get single command by id
  router.get('/commands/:deviceId/:id', (req, res) => {
    const row = db.prepare(`
      SELECT * FROM commands WHERE id = ? AND device_id = ?
    `).get(req.params.id, req.params.deviceId);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
  
  // ──────────────────────────────────────────────────────────────
  // 🆕 PHASE 3: RULE ENGINE (Persistence)
  // ──────────────────────────────────────────────────────────────
  
  // Save rule flow for a device
  router.post('/rules/:deviceId', (req, res) => {
    const { name, nodes, edges, version = 1 } = req.body;
    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      return res.status(400).json({ error: 'nodes and edges must be arrays' });
    }
    
    const ruleId = req.body.ruleId || randomUUID();
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO rule_flows (rule_id, device_id, name, version, definition_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(rule_id) DO UPDATE SET
        name=excluded.name,
        definition_json=excluded.definition_json,
        version=excluded.version,
        updated_at=excluded.updated_at
    `).run(ruleId, req.params.deviceId, name || 'Untitled Rule', version, JSON.stringify({ nodes, edges }), now, now);
    
    res.json({ ruleId, name: name || 'Untitled Rule', version, nodes, edges });
  });
  
  // Load rule flow
  router.get('/rules/:deviceId', (req, res) => {
    const rows = db.prepare(`
      SELECT rule_id, name, version, definition_json, created_at, updated_at
      FROM rule_flows WHERE device_id = ?
      ORDER BY updated_at DESC
    `).all(req.params.deviceId);
    
    const flows = rows.map(r => ({ ...r, definition: JSON.parse(r.definition_json) }));
    res.json(flows);
  });
  
  router.get('/rules/:deviceId/:ruleId', (req, res) => {
    const row = db.prepare(`
      SELECT rule_id, name, version, definition_json, created_at, updated_at
      FROM rule_flows WHERE rule_id = ? AND device_id = ?
    `).get(req.params.ruleId, req.params.deviceId);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ ...row, definition: JSON.parse(row.definition_json) });
  });
  
  // Delete rule
  router.delete('/rules/:deviceId/:ruleId', (req, res) => {
    const info = db.prepare(`DELETE FROM rule_flows WHERE rule_id = ? AND device_id = ?`).run(req.params.ruleId, req.params.deviceId);
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  });
  
  // Run log (execution history of rules)
  router.post('/rules/:deviceId/:ruleId/run-log', (req, res) => {
    const { trigger_packet_msg_id, result, details } = req.body;
    const ts = Date.now();
    const info = db.prepare(`
      INSERT INTO rule_run_logs (rule_id, device_id, ts, trigger_packet_msg_id, result, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.ruleId, req.params.deviceId, ts, trigger_packet_msg_id || null, result || 'ok', JSON.stringify(details || {}));
    
    // Publish realtime
    eventBusRef.publishRuleRun({
      ruleId: req.params.ruleId,
      deviceId: req.params.deviceId,
      ts,
      trigger_packet_msg_id: trigger_packet_msg_id || null,
      result: result || 'ok',
      details: details || {}
    });
    
    res.json({ id: info.lastInsertRowid, ts });
  });
  
  router.get('/rules/:deviceId/:ruleId/run-log', (req, res) => {
    const rows = db.prepare(`
      SELECT * FROM rule_run_logs WHERE rule_id = ? AND device_id = ?
      ORDER BY ts DESC LIMIT 200
    `).all(req.params.ruleId, req.params.deviceId);
    res.json(rows.map(r => ({ ...r, details: JSON.parse(r.details) })));
  });
  
  return router;
}
