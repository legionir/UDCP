savePacket(p) {
  db.prepare(`
    INSERT INTO packets 
    (device_id,msg_id,stream_id,type,name,seq,qos,transport,size,received_at,status,payload)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    p.deviceId,
    p.msgId || '',
    p.streamId,
    p.type,
    p.name,
    p.seq,
    p.qos,
    p.transport,
    p.size,
    p.timestamp,
    p.status,
    JSON.stringify(p.payload)
  );
}
