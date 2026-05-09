// server/src/protocol.js
export class BinaryCodec {
  static decodeMotion(buffer) {
    if (buffer.length !== 36) return null;
    const view = new DataView(buffer.buffer);
    return {
      version: buffer[0],
      type: buffer[1],
      seq: view.getUint16(2, true),
      ts: view.getUint32(4, true),
      ax: view.getFloat32(8, true),
      ay: view.getFloat32(12, true),
      az: view.getFloat32(16, true),
      gx: view.getFloat32(20, true),
      gy: view.getFloat32(24, true),
      gz: view.getFloat32(28, true),
      crc: view.getUint32(32, true)
    };
  }
}

// Async Transport Abstraction
export class TransportPool {
  constructor() {
    this.udp = null;
    this.ws = new Set();
    this.metrics = { udp: {}, ws: {}, http: {} };
  }
  
  broadcast(msg, exclude) {
    const data = JSON.stringify(msg);
    for (const client of this.ws) {
      if (client !== exclude && client.readyState === 1)
        client.send(data);
    }
  }
}
