import { useEffect, useRef, useState } from 'react';

export function useWebSocket(url: string) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  
  const connect = () => {
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      
      ws.onopen = () => {
        setConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
        } catch {}
      };
      
      ws.onclose = () => {
        setConnected(false);
        scheduleReconnect();
      };
      
      ws.onerror = () => {
        setError('WebSocket error');
      };
      
    } catch (e) {
      scheduleReconnect();
    }
  };
  
  const scheduleReconnect = () => {
    if (reconnectAttempts.current >= 10) return;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
    reconnectAttempts.current++;
    
    reconnectTimer.current = window.setTimeout(() => {
      connect();
    }, delay);
  };
  
  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [url]);
  
  const send = (data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  };
  
  return { connected, lastMessage, error, send };
}
