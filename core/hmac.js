import crypto from 'crypto';

export function hmacHex(secret, input) {
  return crypto.createHmac('sha256', secret).update(input).digest('hex');
}

export function canonicalString(msg) {
  const route = Array.isArray(msg.route) ? msg.route.slice().sort().join(',') : '';
  const a = msg.auth || {};
  return [
    msg.v ?? 1,
    msg.msgId ?? '',
    msg.ts ?? 0,
    msg.type ?? '',
    msg.name ?? '',
    msg.seq ?? 0,
    msg.streamId ?? '',
    msg.qos ?? 0,
    route,
    a.id ?? '',
    a.nonce ?? '',
    a.ts ?? 0,
    a.exp ?? 0
  ].join('|');
}
