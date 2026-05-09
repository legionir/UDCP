import EventEmitter from 'events';

// (کلاس قبلی همان است) + افزودن:
export const eventBus = new UdcpEventBus();

// افزودن methodهای جدید:
eventBus.publishRuleRun = function(run) {
  this.emit('rule:run', run);
  this.emit(`rule:run:${run.deviceId}`, run);
  this.emit(`rule:run:${run.deviceId}:${run.ruleId}`, run);
};

// در initSse(app, bus) افزودن:
app.get('/api/events', (req, res) => {
  const { channel, deviceId, streamId, ruleId } = req.query;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  let handler;
  
  if (channel === 'packets') {
    handler = (packet) => res.write(`event: packet\ndata: ${JSON.stringify(packet)}\n\n`);
    bus.on('packet', handler);
  } else if (channel === 'metrics') {
    handler = (metric) => res.write(`event: metric\ndata: ${JSON.stringify(metric)}\n\n`);
    bus.on('metric', handler);
  } else if (channel === 'device:status') {
    handler = (s) => res.write(`event: device:status\ndata: ${JSON.stringify(s)}\n\n`);
    bus.on('device:status', handler);
  } else if (channel === 'command:update') {
    handler = (cmd) => res.write(`event: command:update\ndata: ${JSON.stringify(cmd)}\n\n`);
    bus.on('command:update', handler);
  } else if (ruleId && deviceId) {
    handler = (run) => res.write(`event: rule:run\ndata: ${JSON.stringify(run)}\n\n`);
    bus.on(`rule:run:${deviceId}:${ruleId}`, handler);
  } else if (deviceId && channel === 'commands') {
    handler = (cmd) => res.write(`event: command:update\ndata: ${JSON.stringify(cmd)}\n\n`);
    bus.on(`command:${deviceId}`, handler);
  } else if (deviceId) {
    handler = (packet) => res.write(`event: packet\ndata: ${JSON.stringify(packet)}\n\n`);
    bus.on(`packet:${deviceId}`, handler);
  } else {
    handler = (packet) => res.write(`event: packet\ndata: ${JSON.stringify(packet)}\n\n`);
    bus.on('packet', handler);
  }
  
  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
  }, 30000);
  
  req.on('close', () => {
    if (handler) {
      if (channel === 'packets') bus.off('packet', handler);
      else if (channel === 'metrics') bus.off('metric', handler);
      else if (channel === 'device:status') bus.off('device:status', handler);
      else if (channel === 'command:update') bus.off('command:update', handler);
      else if (ruleId && deviceId) bus.off(`rule:run:${deviceId}:${ruleId}`, handler);
      else if (deviceId) bus.off(`packet:${deviceId}`, handler);
      else bus.off('packet', handler);
    }
    clearInterval(heartbeat);
  });
});
