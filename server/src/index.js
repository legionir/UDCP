
import express from 'express';
import { WebSocketServer } from 'ws';
import dgram from 'dgram';
import crypto from 'crypto';

const HTTP_PORT = 3000;
const WS_PORT = 8080;
const UDP_PORT = 9000;
const AUTH_SECRET = 'shared-hmac-secret';
const AUTH_TOKEN = 'secret-token';
const MAX_QUEUE = 1024;
const MAX_UDP = 1100;

const app = express();
app.use(express.json({ limit: '128kb' }));

const udp = dgram.createSocket('udp4');
const ws = new WebSocketServer({ port: WS_PORT });

// State
const clients = new Set();
const streamSeq = new Map();
const dedupCache = new Map();
const replayCache = new Map();
const reorderBuf = new Map(); // streamId -> { expected, buffer: Map<seq, msg>, lastTouch }

function now() { return Date.now(); }

function hmacHex(data) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('hex');
}

function canonicalRoute(arr) {
  return Array.isArray(arr) ? arr.slice().sort().join(',') : '';
}

function validate(msg) {
  if (!msg || typeof msg !== 'object') return { ok: false, code: 'INVALID_JSON' };
  const req = ['v','msgId','ts','type','name','seq','streamId','value','qos','route','auth','meta'];
  for (const k of req) if (!(k in msg)) return { ok: false, code: 'MISSING_FIELD', field: k };
  if (msg.v !== 1) return { ok: false, code: 'BAD_VERSION' };
  if (![0,1,2].includes(msg.qos)) return { ok: false, code: 'BAD_QOS' };
  return { ok: true };
}

function authOk(msg, transport, headerToken) {
  const a = msg.auth || {};
  if (a.token !== AUTH_TOKEN && headerToken !== AUTH_TOKEN) return false;
  if (typeof a.exp !== 'number' || a.exp < now()) return false;
  const key = `${a.id}:${a.nonce}:${transport}`;
  if (replayCache.has(key)) return false;
  replayCache.set(key, now());

  // HMAC verify
  const base = [msg.v, msg.msgId, msg.ts, msg.type, msg.name, msg.seq, msg.streamId, msg.qos,
                canonicalRoute(msg.route), a.id, a.nonce, a.ts, a.exp].join('|');
  return a.sig === hmacHex(base);
}

function buildAck(msgId, status, seq, streamId, transport) {
  return {
    v: 1, msgId: `ack-${now()}-${Math.random().toString(16).slice(2,8)}`, ts: now(),
    type: 'ack', name: 'ack', seq: 0, streamId: streamId || 'system',
    value: { ackFor: msgId, status, ackSeq: seq || 0, ackTs: now(), streamId },
    qos: 0, auth: null, meta: {}, route: [transport]
  };
}

function buildError(code, msg) {
  return { v:1, msgId:`err-${now()}`, ts:now(), type:'error', name:'protocol', seq:0, streamId:'error',
           value:{code,message:msg}, qos:0, auth:null, meta:{}, route:['http'] };
}

function processReorder(streamId) {
  const st = reorderBuf.get(streamId);
  if (!st) return;
  let exp = st.expected;
  while (st.buffer.has(exp)) {
    const m = st.buffer.get(exp);
    st.buffer.delete(exp);
    exp++;
    // Emit to app layer here if needed
  }
  st.expected = exp;
  st.lastTouch = now();
  if (now() - st.lastTouch > 5000) { st.buffer.clear(); st.expected = 0; }
}

function handle(msg, transport, reply, headerToken) {
  const v = validate(msg);
  if (!v.ok) return reply(buildError(v.code, v.field || ''));
  if (!authOk(msg, transport, headerToken)) return reply(buildError('AUTH_FAILED', ''));

  const { msgId, seq, streamId, qos, type, name, value } = msg;

  // Dedup for QoS2
  if (qos === 2) {
    const dk = `${streamId}:${msgId}`;
    if (dedupCache.has(dk)) return reply(buildAck(msgId, 'duplicate', seq, streamId, transport));
    dedupCache.set(dk, now());
  }

  // Reorder
  if (!reorderBuf.has(streamId)) reorderBuf.set(streamId, { expected: 0, buffer: new Map(), lastTouch: now() });
  const st = reorderBuf.get(streamId);
  if (seq < st.expected) return reply(buildAck(msgId, 'out_of_order', seq, streamId, transport));
  if (seq > st.expected + 1 && type === 'stream') {
    st.buffer.set(seq, msg);
    return reply(buildAck(msgId, 'buffered', seq, streamId, transport));
  }
  st.expected = seq + 1;
  processReorder(streamId);

  // App logic
  if (type === 'command' && name === 'led') console.log('[CMD] LED:', value);

  // Broadcast
  const data = JSON.stringify(msg);
  for (const c of clients) if (c.readyState === 1) c.send(data);
  udp.send(data, 0, data.length, UDP_PORT, '0.0.0.0');

  if (qos > 0) reply(buildAck(msgId, 'ok', seq, streamId, transport));
}

// HTTP
app.post('/message', (req, res) => handle(req.body, 'http', (r) => res.json(r), req.headers['x-udcp-token']));
app.get('/state', (req, res) => res.json({ streams: [...streamSeq.entries()] }));
app.get('/health', (req, res) => res.json({ ts: now(), cache: { dedup: dedupCache.size, replay: replayCache.size } }));

// WS
ws.on('connection', (s) => {
  clients.add(s);
  s.on('message', (d) => {
    try { handle(JSON.parse(d), 'ws', (r) => s.send(JSON.stringify(r))); }
    catch { s.send(JSON.stringify(buildError('INVALID_JSON', ''))); }
  });
  s.on('close', () => clients.delete(s));
});

// UDP
udp.on('message', (buf, rinfo) => {
  if (buf.length > MAX_UDP) return udp.send(JSON.stringify(buildError('TOO_LARGE', '')), rinfo.port, rinfo.address);
  try {
    const msg = JSON.parse(buf.toString());
    handle(msg, 'udp', (r) => udp.send(JSON.stringify(r), rinfo.port, rinfo.address));
  } catch { udp.send(JSON.stringify(buildError('INVALID_JSON', '')), rinfo.port, rinfo.address); }
});
udp.bind(UDP_PORT);

// Cleanup
setInterval(() => {
  const t = now();
  for (const [k, v] of dedupCache.entries()) if (t - v > 60000) dedupCache.delete(k);
  for (const [k, v] of replayCache.entries()) if (t - v > 30000) replayCache.delete(k);
  if (dedupCache.size > MAX_QUEUE) { const keys = [...dedupCache.keys()].slice(0, dedupCache.size - MAX_QUEUE/2); keys.forEach(k => dedupCache.delete(k)); }
  if (replayCache.size > MAX_QUEUE) { const keys = [...replayCache.keys()].slice(0, replayCache.size - MAX_QUEUE/2); keys.forEach(k => replayCache.delete(k)); }
}, 2000);

app.listen(HTTP_PORT, () => console.log(`HTTP :${HTTP_PORT}`));
console.log(`WS :${WS_PORT} | UDP :${UDP_PORT}`);

---
