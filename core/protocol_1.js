function enrichPacket(msg, transport) {
  return {
    timestamp: Date.now(),
    deviceId: msg.meta?.deviceId || 'unknown',
    type: msg.type,
    name: msg.name,
    streamId: msg.streamId,
    seq: msg.seq,
    qos: msg.qos,
    transport,
    size: JSON.stringify(msg).length,
    rtt: 0,
    status: 'ok',
    payload: msg.value
  };
}

و داخل `processMessage`:

const packet = enrichPacket(msg, transport);

metrics.collectPacket(packet);
storage.savePacket(packet);
eventBus.publishPacket(packet);
