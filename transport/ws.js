import { WebSocketServer } from 'ws';
import { processMessage } from '../core/protocol.js';

export function startWS(ctx) {
  const wss = new WebSocketServer({ port: 8080 });

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }

      processMessage(msg, {
        ...ctx,
        transport: 'ws',
        reply: (res) => ws.send(JSON.stringify(res))
      });
    });
  });

  return wss;
}
