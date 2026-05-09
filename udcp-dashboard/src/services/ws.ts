export class UdcpWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  
  constructor(url: string) {
    this.url = url;
    this.connect();
  }
  
  connect() {
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('✅ [WS] Connected to', this.url);
        this.reconnectAttempts = 0;
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Emit to listeners by event type
          const type = data.type || 'message';
          const listeners = this.listeners.get(type);
          if (listeners) {
            listeners.forEach(cb => cb(data));
          }
          // Also emit wildcard
          const allListeners = this.listeners.get('*');
          if (allListeners) {
            allListeners.forEach(cb => cb(data));
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };
      
      this.ws.onclose = () => {
        console.log('🔌 [WS] Disconnected');
        this.scheduleReconnect();
      };
      
      this.ws.onerror = (err) => {
        console.error('❌ [WS] Error:', err);
      };
      
    } catch (e) {
      this.scheduleReconnect();
    }
  }
  
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ [WS] Max reconnect attempts reached');
      return;
    }
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    
    console.log(`🔄 [WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }
  
  off(event: string, callback: (data: any) => void) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }
  
  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
  
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}