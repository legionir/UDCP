import dgram from 'dgram';
import { validateMessage, buildError } from '../core/protocol.js';
import { verifyAuth } from '../core/hmac.js';
import { eventBus } from '../ui-gateway/events.js';
import { metricsCollector } from '../metrics/collector.js';

const UDP_PORT = Number(process.env.UDP_PORT || 9000);
const MAX_UDP = 1100;
const AUTH_SECRET = process.env.AUTH_SECRET || 'shared-hmac-secret';

export function udpServer(httpServer, db, eventBusRef) {
  const udp = dgram.createSocket('udp4');
  
  udp.on('message', (buf, rinfo) => {
    if (buf.length > MAX_UDP) {
      const err = buildError('PACKET_TOO_LARGE', `UDP packet > ${MAX_UDP} bytes`);
      udp.send(JSON.stringify(err), rinfo.port, rinfo.address);
      return;
    }
    
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      const err = buildError('INVALID_JSON', 'Unable to parse JSON');
      udp.send(JSON.stringify(err), rinfo.port, rinfo.address);
      return;
    }
    
    // Validate
    const v = validateMessage(msg);
    if (!v.ok) {
      const err = buildError('INVALID_SCHEMA', JSON.stringify(v.error));
      udp.send(JSON.stringify(err), rinfo.port, rinfo.address);
      return;
    }
    
    // Auth
    const authRes = verifyAuth(msg, AUTH_SECRET);
    if (!authRes.valid) {
      const err = buildError('AUTH_FAILED', authRes.reason);
      udp.send(JSON.stringify(err), rinfo.port, rinfo.address);
      return;
    }
    
    const recvTs = Date.now();
    
    // Store packet
    try {
      db.prepare(`
        INSERT INTO packets (device_id, msg_id, stream_id, type, name, seq, qos, transport, size, received_at, status, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'udp', ?, ?, 'ok', ?)
      `).run(
        msg.meta?.deviceId || 'unknown',
        msg.msgId,
        msg.streamId,
        msg.type,
        msg.name,
        msg.seq,
        msg.qos,
        buf.length,
        recvTs,
        JSON.stringify(msg.value)
      );
      
      // Update device last_seen
      db.prepare(`
        INSERT OR REPLACE INTO devices (id, name, platform, firmware, first_seen, last_seen, status, metadata)
        VALUES (
          COALESCE((SELECT id FROM devices WHERE id = ?), ?),
          COALESCE((SELECT name FROM devices WHERE id = ?), ?),
          COALESCE((SELECT platform FROM devices WHERE id = ?), 'esp32'),
          COALESCE((SELECT firmware FROM devices WHERE id = ?), 'unknown'),
          COALESCE((SELECT first_seen FROM devices WHERE id = ?), ?),
          ?,
          'online',
          COALESCE((SELECT metadata FROM devices WHERE id = ?), '{}')
        )
      `).run(
        msg.meta?.deviceId || 'unknown',
        msg.meta?.deviceId || 'unknown',
        msg.meta?.deviceId || 'unknown',
        msg.meta?.deviceId || 'unknown',
        msg.meta?.deviceId || 'unknown',
        msg.meta?.deviceId || 'unknown',
        recvTs,
        recvTs,
        msg.meta?.deviceId || 'unknown'
      );
      
    } catch (e) {
      console.error('[UDP] DB error:', e.message);
    }
    
    // Publish to realtime bus
    eventBusRef.publishPacket({
      ...msg,
      transport: 'udp',
      size: buf.length,
      receivedAt: recvTs
    });
    
    // Collect metrics (RTT if this is an ACK response)
    if (msg.type === 'ack') {
      metricsCollector.recordAck(msg.meta?.deviceId || 'unknown', 'udp', msg.ts, recvTs);
    }
    
    // Auto-ACK for QoS>0
    if (msg.qos > 0) {
      const ack = {
        v: 1,
        msgId: `ack-${Date.now()}-${Math.random().toString(16).slice(2,8)}`,
        ts: Date.now(),
        type: 'ack',
        name: 'ack',
        seq: 0,
        streamId: msg.streamId,
        value: {
          ackFor: msg.msgId,
          status: 'ok',
          ackSeq: msg.seq,
          ackTs: Date.now(),
          streamId: msg.streamId
        },
        qos: 0,
        auth: null,
        meta: { deviceId: 'server' },
        route: ['udp']
      };
      udp.send(JSON.stringify(ack), rinfo.port, rinfo.address);
    }
  });
  
  udp.on('listening', () => {
    const addr = udp.address();
    console.log(`✅ [UDP] Listening on ${addr.address}:${addr.port}`);
  });
  
  udp.on('error', (err) => {
    console.error('❌ [UDP] Error:', err.message);
  });
  
  udp.bind(UDP_PORT);
  
  return udp;
}

