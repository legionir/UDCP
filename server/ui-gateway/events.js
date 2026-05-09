import EventEmitter from 'events';

// ──────────────────────────────────────────────────────────────
// UDCP EVENT BUS (Realtime)
// ──────────────────────────────────────────────────────────────
class UdcpEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(10000);
  }
  
  publishPacket(packet) {
    this.emit('packet', packet);
    this.emit(`packet:${packet.deviceId}`, packet);
    this.emit(`packet:${packet.deviceId}:${packet.streamId}`, packet);
    this.emit(`transport:${packet.transport}`, packet);
  }
  
  publishMetric(metric) {
    this.emit('metric', metric);
    this.emit(`metric:${metric.deviceId}`, metric);
    this.emit(`metric:${metric.deviceId}:${metric.transport}`, metric);
  }
  
  publishDeviceStatus(deviceId, status) {
    this.emit('device:status', { deviceId, status, ts: Date.now() });
  }
  
  publishCommandUpdate(command) {
    this.emit('command:update', command);
    this.emit(`command:${command.deviceId}`, command);
  }
}

export const eventBus = new UdcpEventBus();

// ──────────────────────────────────────────────────────────────
// SSE ENDPOINT
// ──────────────────────────────────────────────────────────────
export function initSse(app, bus) {
  app.get('/api/events', (req, res) => {
    const { channel, deviceId, streamId } = req.query;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    let eventHandler;
    
    if (channel === 'packets') {
      eventHandler = (packet) => {
        res.write(`event: packet\ndata: ${JSON.stringify(packet)}\n\n`);
      };
      bus.on('packet', eventHandler);
      
    } else if (channel === 'metrics') {
      eventHandler = (metric) => {
        res.write(`event: metric\ndata: ${JSON.stringify(metric)}\n\n`);
      };
      bus.on('metric', eventHandler);
      
    } else if (deviceId && streamId) {
      eventHandler = (packet) => {
        res.write(`event: packet\ndata: ${JSON.stringify(packet)}\n\n`);
      };
      bus.on(`packet:${deviceId}:${streamId}`, eventHandler);
      
    } else if (deviceId) {
      eventHandler = (packet) => {
        res.write(`event: packet\ndata: ${JSON.stringify(packet)}\n\n`);
      };
      bus.on(`packet:${deviceId}`, eventHandler);
      
    } else {
      // Default: all packets
      eventHandler = (packet) => {
        res.write(`event: packet\ndata: ${JSON.stringify(packet)}\n\n`);
      };
      bus.on('packet', eventHandler);
    }
    
    // Heartbeat
    const heartbeat = setInterval(() => {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    }, 30000);
    
    req.on('close', () => {
      if (eventHandler) bus.off(channel || 'packet', eventHandler);
      clearInterval(heartbeat);
      console.log('🔌 [SSE] Client disconnected');
    });
  });
}
