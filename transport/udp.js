import dgram from 'dgram';
import { processMessage } from '../core/protocol.js';

export function startUDP(ctx) {
  const server = dgram.createSocket('udp4');

  server.on('message', (buf, rinfo) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      return;
    }

    processMessage(msg, {
      ...ctx,
      transport: 'udp',
      reply: (res) => {
        server.send(Buffer.from(JSON.stringify(res)), rinfo.port, rinfo.address);
      }
    });
  });

  server.bind(9000);
}

