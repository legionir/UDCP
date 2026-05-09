import { WebSocketServer } from 'ws';
import { validateMessage, buildError, buildAck } from '../core/protocol.js';
import { verifyAuth } from '../core/hmac.js';
import { eventBus } from '../ui-gateway/events.js';
import { metricsCollector } from '../metrics/collector.js';

const WS_PORT = Number(process.env.WS_PORT || 8080);
const AUTH_SECRET = process.env.AUTH_SECRET || 'shared-hmac-secret';

export function wsServer(httpServer, db, eventBusRef) {
  const wss = new WebSocketServer({ server: httpServer, path: '/' });
  
  const clients = new Map(); // ws -> { deviceId, lastSeen }
  
  wss.on('connection', (ws, req) => {
    console.log('🔌 [WS] Client connected:', req.socket.remoteAddress);
    clients.set(ws, { deviceId: null, lastSeen: Date.now() });
    
    ws.on('message', (data) => {
      clients.set(ws, { ...clients.get(ws), lastSeen: Date.now() });
      
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        ws.send(JSON.stringify(buildError('INVALID_JSON', 'Unable to parse JSON')));
        return;
      }
      
      // Validate
      const v = validateMessage(msg);
      if (!v.ok) {
        ws.send(JSON.stringify(buildError('INVALID_SCHEMA', JSON.stringify(v.error))));
        return;
      }
      
      // Auth
      const authRes = verifyAuth(msg, AUTH_SECRET);
      if (!authRes.valid) {
        ws.send(JSON.stringify(buildError('AUTH_FAILED', authRes.reason)));
        return;
      }
      
      const deviceId = msg.meta?.deviceId || msg.auth?.id || 'unknown';
      clients.set(ws, { deviceId, lastSeen: Date.now() });
      
      const recvTs = Date.now();
      
      // Store packet
      try {
        db.prepare(`
          INSERT INTO packets (device_id, msg_id, stream_id, type, name, seq, qos, transport, size, received_at, status, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'ws', ?, ?, 'ok', ?)
        `).run(
          deviceId,
          msg.msgId,
          msg.streamId,
          msg.type,
          msg.name,
          msg.seq,
          msg.qos,
          data.length,
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
        console.error('[WS] DB error:', e.message);
      }
      
      // Publish realtime
      eventBusRef.publishPacket({ ...msg, transport: 'ws', size: data.length, receivedAt: recvTs });
      
      // Metrics
      if (msg.type === 'ack') {
        metricsCollector.recordAck(deviceId, 'ws', msg.ts, recvTs);
      }
      
      // Auto-ACK QoS>0
      if (msg.qos > 0) {
        const ack = buildAck(msg, 'ok');
        ws.send(JSON.stringify(ack));
      }
    });
    
    ws.on('close', () => {
      const info = clients.get(ws);
      if (info?.deviceId) {
        // Mark device as offline (graceful)
        db.prepare(`
          UPDATE devices SET status = 'offline', last_seen = ? WHERE id = ?
        `).run(Date.now(), info.deviceId);
        eventBusRef.publishDeviceStatus(info.deviceId, 'offline');
      }
      clients.delete(ws);
      console.log('🔌 [WS] Client disconnected');
    });
    
    ws.on('error', (err) => {
      console.error('❌ [WS] Error:', err.message);
    });
  });
  
  // Broadcast helper
  eventBusRef.on('broadcast', (msg) => {
    const data = JSON.stringify(msg);
    for (const [ws, info] of clients.entries()) {
      if (ws.readyState === 1) {
        ws.send(data);
      }
    }
  });
  
  console.log(`✅ [WS] Server initialized on ws://0.0.0.0:${WS_PORT}`);
  return wss;
}

