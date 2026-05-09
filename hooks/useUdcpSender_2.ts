import { v4 as uuid } from 'uuid';

export function useUdcpSender() {

  const sendStream = (msg:any) => {

    const packet = {
      v:1,
      msgId:`ui-${uuid()}`,
      ts:Date.now(),
      type:msg.type,
      name:msg.name,
      seq:1,
      streamId: msg.name + "-ui",
      value: msg.value,
      qos: msg.qos || 0,
      route: msg.transport || ['ws'],
      auth:null,
      meta:{
        deviceId:'ui-client',
        platform:'web'
      }
    };

    // WS
    if (packet.route.includes('ws')) {
      window.ws?.send(JSON.stringify(packet));
    }

    // HTTP fallback
    if (packet.route.includes('http')) {
      fetch('/message',{
        method:'POST',
        body: JSON.stringify(packet),
        headers:{'Content-Type':'application/json'}
      });
    }
  };

  return { sendStream };
}

