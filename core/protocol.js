import { validateMessage } from './validation.js';
import { canonicalString, hmacHex } from './hmac.js';

export function processMessage(msg, ctx) {
  const { transport, reply, authSecret, authToken, metrics, storage, eventBus } = ctx;

  const v = validateMessage(msg);
  if (!v.ok) return reply(error('INVALID_SCHEMA', v.error));

  if (!authOk(msg, authSecret, authToken, transport))
    return reply(error('AUTH_FAILED'));

  // metrics
  metrics.collectPacket(msg, transport);

  // persist
  storage.savePacket(msg, transport);

  // publish realtime
  eventBus.publishPacket(msg);

  // ACK
  if (msg.qos > 0) {
    return reply(ack(msg, transport));
  }
}

function authOk(msg, secret, token, transport) {
  const a = msg.auth || {};
  if (a.token !== token) return false;
  if (Date.now() > a.exp) return false;

  const expected = hmacHex(secret, canonicalString(msg));
  return expected === a.sig;
}

function ack(msg, transport) {
  return {
    v:1,
    msgId:`ack-${Date.now()}`,
    ts:Date.now(),
    type:'ack',
    name:'ack',
    seq:0,
    streamId:msg.streamId,
    value:{
      ackFor: msg.msgId,
      ackSeq: msg.seq,
      ackTs: Date.now()
    },
    qos:0,
    auth:null,
    meta:{},
    route:[transport]
  };
}

function error(code, message='') {
  return {
    v:1,
    msgId:`err-${Date.now()}`,
    ts:Date.now(),
    type:'error',
    name:'protocol',
    seq:0,
    streamId:'error',
    value:{code,message},
    qos:0,
    auth:null,
    meta:{},
    route:['http']
  };
}