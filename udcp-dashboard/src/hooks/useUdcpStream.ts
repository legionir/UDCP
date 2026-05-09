import { useEffect, useState } from 'react';

/**
 * Hook for consuming Server-Sent Events (SSE) from /api/events
 * Supports filtering by channel, deviceId, streamId
 */
export function useUdcpStream<T = any>(options: {
  channel?: 'packets' | 'metrics' | 'device:status' | 'command:update';
  deviceId?: string;
  streamId?: string;
  bufferSize?: number;
} = {}) {
  const { channel = 'packets', deviceId, streamId, bufferSize = 1000 } = options;
  const [data, setData] = useState<T[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Build query params
    const params = new URLSearchParams();
    if (channel) params.append('channel', channel);
    if (deviceId) params.append('deviceId', deviceId);
    if (streamId) params.append('streamId', streamId);
    
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/events?${params.toString()}`;
    
    const es = new EventSource(url);
    
    es.onopen = () => {
      setConnected(true);
      setError(null);
    };
    
    es.addEventListener('packet', (e) => {
      try {
        const packet = JSON.parse(e.data);
        setData(prev => [packet, ...prev].slice(0, bufferSize));
      } catch (err) {
        console.error('[SSE] Packet parse error:', err);
      }
    });
    
    es.addEventListener('metric', (e) => {
      try {
        const metric = JSON.parse(e.data);
        setData(prev => [metric, ...prev].slice(0, bufferSize));
      } catch (err) {
        console.error('[SSE] Metric parse error:', err);
      }
    });
    
    es.addEventListener('device:status', (e) => {
      try {
        const status = JSON.parse(e.data);
        setData(prev => [status, ...prev].slice(0, bufferSize));
      } catch (err) {
        console.error('[SSE] Status parse error:', err);
      }
    });
    
    es.addEventListener('command:update', (e) => {
      try {
        const cmd = JSON.parse(e.data);
        setData(prev => [cmd, ...prev].slice(0, bufferSize));
      } catch (err) {
        console.error('[SSE] Command parse error:', err);
      }
    });
    
    es.addEventListener('heartbeat', () => {
      // Keep-alive
    });
    
    es.onerror = () => {
      setConnected(false);
      setError('SSE connection error');
    };
    
    return () => {
      es.close();
      setConnected(false);
    };
  }, [channel, deviceId, streamId, bufferSize]);
  
  return { data, connected, error };
}
