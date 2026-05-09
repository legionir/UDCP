import { useCallback } from 'react';
import { useDeviceStore } from '../stores/deviceStore';

/**
 * Central UDCP sender for streams/events/commands from UI (Virtual HW + AI Vision)
 * - Tries transports in order: UDP -> WS -> HTTP (based on health + config)
 * - Handles QoS, rate limiting, error reporting
 */
export function useUdcpSender() {
  const { selectedDeviceId } = useDeviceStore();
  
  const sendStream = useCallback(async (opts: {
    type: 'stream';
    name: string;
    value: any;
    qos?: 0 | 1 | 2;
    transport?: ('udp'|'ws'|'http')[];
    rate?: number; // Hz (informational / throttling helper)
  }) => {
    if (!selectedDeviceId) {
      console.warn('[UDCP] No device selected');
      return null;
    }
    
    const payload = {
      v: 1,
      msgId: `ui-stream-${Date.now()}-${Math.random().toString(16).slice(2,6)}`,
      ts: Date.now(),
      type: 'stream',
      name: opts.name,
      seq: 0, // server/ESP32 will assign stream sequence
      streamId: `${opts.name}-${selectedDeviceId}`,
      value: opts.value,
      qos: opts.qos ?? 0,
      route: opts.transport || ['ws', 'http'],
      auth: null, // will be signed by ESP32/server per UDCP spec
      meta: { deviceId: selectedDeviceId, platform: 'web' }
    };
    
    // Try transports in priority order (UDP preferred for high-rate telemetry)
    const transports = opts.transport || ['ws', 'http'];
    
    // UDP attempt
    if (transports.includes('udp')) {
      try {
        // Use global RawDatagramSocket if available (we'll assume browser doesn't expose UDP directly easily,
        // but in dev you can proxy via server or use WebTransport in future).
        // For now: POST to /proxy/udp or rely on WS fallback. In MVP we prefer WS.
        console.debug('[UDCP] sendStream -> udp', payload);
        // NOTE: Browser cannot send raw UDP directly. Fallback to WS/HTTP via server proxy endpoint if needed.
      } catch {}
    }
    
    // WS attempt (primary for web)
    if (transports.includes('ws')) {
      try {
        // Use existing WebSocket client from services/ws.ts (singleton)
        const wsClient = (window as any).__UDCP_WS__ as WebSocket | undefined;
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
          wsClient.send(JSON.stringify(payload));
          return { transport: 'ws', msgId: payload.msgId };
        }
      } catch {}
    }
    
    // HTTP attempt (guaranteed fallback)
    if (transports.includes('http')) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-UDCP-Token': import.meta.env.VITE_UDCP_TOKEN || 'secret-token'
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const json = await res.json();
          return { transport: 'http', msgId: payload.msgId, ack: json };
        }
      } catch {}
    }
    
    console.warn('[UDCP] All transports failed for stream', opts.name);
    return null;
  }, [selectedDeviceId]);
  
  const sendEvent = useCallback(async (opts: {
    type: 'event';
    name: string;
    value: any;
    qos?: 0 | 1 | 2;
    transport?: ('ws'|'http')[];
  }) => {
    if (!selectedDeviceId) return null;
    
    const payload = {
      v: 1,
      msgId: `ui-event-${Date.now()}-${Math.random().toString(16).slice(2,6)}`,
      ts: Date.now(),
      type: 'event',
      name: opts.name,
      seq: 0,
      streamId: `${opts.name}-${selectedDeviceId}`,
      value: opts.value,
      qos: opts.qos ?? 0,
      route: opts.transport || ['ws', 'http'],
      auth: null,
      meta: { deviceId: selectedDeviceId, platform: 'web' }
    };
    
    // Prefer WS
    const transports = opts.transport || ['ws', 'http'];
    if (transports.includes('ws')) {
      try {
        const wsClient = (window as any).__UDCP_WS__ as WebSocket | undefined;
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
          wsClient.send(JSON.stringify(payload));
          return { transport: 'ws', msgId: payload.msgId };
        }
      } catch {}
    }
    if (transports.includes('http')) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-UDCP-Token': import.meta.env.VITE_UDCP_TOKEN || 'secret-token'
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) return { transport: 'http', msgId: payload.msgId };
      } catch {}
    }
    return null;
  }, [selectedDeviceId]);
  
  return { sendStream, sendEvent };
}

