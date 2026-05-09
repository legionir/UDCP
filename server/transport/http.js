import express from 'express';
import { validateMessage, buildError, buildAck } from '../core/protocol.js';
import { verifyAuth } from '../core/hmac.js';
import { eventBus } from '../ui-gateway/events.js';
import { metricsCollector } from '../metrics/collector.js';

const AUTH_SECRET = process.env.AUTH_SECRET || 'shared-hmac-secret';

export function httpApp(app, db, eventBusRef) {
  // POST /message - Main UDCP message endpoint
  app.post('/message', (req, res) => {
    const headerToken = req.headers['x-udcp-token'];
    
    // Validate
    const v = validateMessage(req.body);
    if (!v.ok) {
      return res.status(400).json(buildError('INVALID_SCHEMA', JSON.stringify(v.error)));
    }
    
    const msg = v.data;
    
    // Auth
    const authRes = verifyAuth(msg, AUTH_SECRET, headerToken);
    if (!authRes.valid) {
      return res.status(401).json(buildError('AUTH_FAILED', authRes.reason));
    }
    
    const deviceId = msg.meta?.deviceId || msg.auth?.id || 'unknown';
    const recvTs = Date.now();
    const size = JSON.stringify(msg).length;
    
    // Store packet
    try {
      db.prepare(`
        INSERT INTO packets (device_id, msg_id, stream_id, type, name, seq, qos, transport, size, received_at, status, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'http', ?, ?, 'ok', ?)
      `).run(
        deviceId,
        msg.msgId,
        msg.streamId,
        msg.type,
        msg.name,
        msg.seq,
        msg.qos,
        size,
        recvTs,
        JSON.stringify(msg.value)
      );
      
      // Update device
      db.prepare(`
        INSERT OR REPLACE INTO devices (id, name, platform, firmware, first_seen, last_seen, status, metadata)
        VALUES (
          ?, COALESCE((SELECT name FROM devices WHERE id = ?), ?), 
          COALESCE((SELECT platform FROM devices WHERE id = ?), 'esp32'),
          COALESCE((SELECT firmware FROM devices WHERE id = ?), 'unknown'),
          COALESCE((SELECT first_seen FROM devices WHERE id = ?), ?),
          ?, 'online', COALESCE((SELECT metadata FROM devices WHERE id = ?), '{}')
        )
      `).run(
        deviceId, deviceId, deviceId,
        deviceId, deviceId, deviceId, recvTs,
        recvTs, deviceId
      );
    } catch (e) {
      console.error('[HTTP] DB error:', e.message);
      return res.status(500).json(buildError('DB_ERROR', e.message));
    }
    
    // Publish realtime
    eventBusRef.publishPacket({ ...msg, transport: 'http', size, receivedAt: recvTs });
    
    // Metrics
    if (msg.type === 'ack') {
      metricsCollector.recordAck(deviceId, 'http', msg.ts, recvTs);
    }
    
    // Auto-ACK QoS>0
    if (msg.qos > 0) {
      const ack = buildAck(msg, 'ok');
      return res.json(ack);
    }
    
    res.json({ ok: true, msgId: msg.msgId });
  });
  
  // GET /state - Current device state
  app.get('/state', (req, res) => {
    const { deviceId, streamId } = req.query;
    if (deviceId && streamId) {
      // Get latest packet for specific stream
      const row = db.prepare(`
        SELECT payload, received_at FROM packets 
        WHERE device_id = ? AND stream_id = ? 
        ORDER BY received_at DESC LIMIT 1
      `).get(deviceId, streamId);
      
      if (!row) return res.json({ value: null });
      return res.json({ value: JSON.parse(row.payload), receivedAt: row.received_at });
    }
    
    if (deviceId) {
      // Get all latest streams for device
      const rows = db.prepare(`
        SELECT stream_id, payload, received_at FROM packets p1
        WHERE device_id = ? AND received_at = (
          SELECT MAX(received_at) FROM packets p2 
          WHERE p2.device_id = p1.device_id AND p2.stream_id = p1.stream_id
        )
      `).all(deviceId);
      
      const state = {};
      for (const r of rows) {
        state[r.stream_id] = { value: JSON.parse(r.payload), receivedAt: r.received_at };
      }
      return res.json({ deviceId, state });
    }
    
    res.json({ error: 'deviceId required' });
  });
  
  // POST /auth/login - Simple auth helper
  app.post('/auth/login', (req, res) => {
    const now = Date.now();
    res.json({
      v: 1,
      msgId: `auth-${now}`,
      ts: now,
      type: 'auth',
      name: 'login',
      value: {
        ok: true,
        token: process.env.AUTH_TOKEN,
        exp: now + 3600000
      },
      qos: 0,
      auth: null,
      meta: {}
    });
  });
}
