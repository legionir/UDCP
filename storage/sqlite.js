import Database from 'better-sqlite3';

export function createDB() {
  const db = new Database('udcp.db');

  return {
    savePacket(msg, transport) {
      db.prepare(`
        INSERT INTO packets (device_id,msg_id,stream_id,type,name,seq,qos,transport,size,received_at,payload)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        msg.meta?.deviceId || 'unknown',
        msg.msgId,
        msg.streamId,
        msg.type,
        msg.name,
        msg.seq,
        msg.qos,
        transport,
        JSON.stringify(msg).length,
        Date.now(),
        JSON.stringify(msg.value)
      );
    }
  };
}
