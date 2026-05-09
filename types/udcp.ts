export type Transport = 'udp' | 'ws' | 'http';

export interface Packet {
  timestamp: number;
  deviceId: string;
  type: string;
  name: string;
  streamId: string;
  seq: number;
  transport: Transport;
  qos: 0 | 1 | 2;
  size: number;
  rtt?: number;
  status: 'ok' | 'dropped' | 'reorder' | 'replay';
  payload?: any;
}

export interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'degraded';
  lastSeen: number;
  platform: string;
  firmware: string;
  uptime: number;
  heap: { free: number; min: number; frag: number };
  transport: any;
  metrics: any;
}

---