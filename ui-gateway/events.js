import EventEmitter from 'events';

export class UdcpEventBus extends EventEmitter {
  publishPacket(p) {
    this.emit('packet', p);
  }
}

export function attachSSE(app, eventBus) {
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');

    const onPacket = (p) => {
      res.write(`event: packet\ndata:${JSON.stringify(p)}\n\n`);
    };

    eventBus.on('packet', onPacket);

    req.on('close', () => {
      eventBus.off('packet', onPacket);
    });
  });
}
