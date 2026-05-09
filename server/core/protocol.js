import crypto from 'crypto';
import { z } from 'zod';

// ──────────────────────────────────────────────────────────────
// UDCP v5 SCHEMA (JSON)
// ──────────────────────────────────────────────────────────────
export const UdcpMessageSchema = z.object({
  v: z.literal(1),
  msgId: z.string().min(1),
  ts: z.number().int().positive(),
  type: z.enum(['event', 'command', 'state', 'stream', 'ack', 'error', 'hello', 'auth']),
  name: z.string().min(1),
  seq: z.number().int().nonnegative(),
  streamId: z.string().min(1),
  value: z.any(),
  qos: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  route: z.array(z.enum(['udp', 'ws', 'http'])).min(1),
  auth: z.object({
    id: z.string(),
    token: z.string(),
    nonce: z.string(),
    ts: z.number().int(),
    exp: z.number().int(),
    sig: z.string()
  }).nullable(),
  meta: z.object({
    deviceId: z.string().optional(),
    platform: z.string().optional()
  }).default({})
});

export function validateMessage(obj) {
  const res = UdcpMessageSchema.safeParse(obj);
  if (!res.success) {
    return { ok: false, error: res.error.flatten() };
  }
  return { ok: true, data: res.data };
}

// ──────────────────────────────────────────────────────────────
// CANONICAL STRING (for HMAC)
// ──────────────────────────────────────────────────────────────
export function canonicalString(msg) {
  const auth = msg.auth || {};
  const route = Array.isArray(msg.route) ? msg.route.slice().sort().join(',') : '';
  return [
    msg.v,
    msg.msgId,
    msg.ts,
    msg.type,
    msg.name,
    msg.seq,
    msg.streamId,
    msg.qos,
    route,
    auth.id || '',
    auth.nonce || '',
    auth.ts || 0,
    auth.exp || 0
  ].join('|');
}

// ──────────────────────────────────────────────────────────────
// HMAC
// ──────────────────────────────────────────────────────────────
export function hmacHex(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

// ──────────────────────────────────────────────────────────────
// BUILD HELPERS
// ──────────────────────────────────────────────────────────────
export function buildAck(originalMsg, status, extra = {}) {
  return {
    v: 1,
    msgId: `ack-${Date.now()}-${Math.random().toString(16).slice(2,8)}`,
    ts: Date.now(),
    type: 'ack',
    name: 'ack',
    seq: 0,
    streamId: originalMsg.streamId || 'system',
    value: {
      ackFor: originalMsg.msgId,
      status,
      ackSeq: originalMsg.seq || 0,
      ackTs: Date.now(),
      streamId: originalMsg.streamId,
      ...extra
    },
    qos: 0,
    auth: null,
    meta: { deviceId: 'server' },
    route: originalMsg.route || ['ws']
  };
}

export function buildError(code, message) {
  return {
    v: 1,
    msgId: `err-${Date.now()}`,
    ts: Date.now(),
    type: 'error',
    name: 'protocol',
    seq: 0,
    streamId: 'error',
    value: { code, message },
    qos: 0,
    auth: null,
    meta: {},
    route: ['http']
  };
}
