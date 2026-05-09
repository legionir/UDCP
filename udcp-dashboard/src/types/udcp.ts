// ──────────────────────────────────────────────────────────────
// UDCP v5 Types
// ──────────────────────────────────────────────────────────────

export type Transport = 'udp' | 'ws' | 'http';

export type QoS = 0 | 1 | 2;

export type MessageType = 'event' | 'command' | 'state' | 'stream' | 'ack' | 'error' | 'hello' | 'auth';

export interface UdcpMessage {
  v: 1;
  msgId: string;
  ts: number;
  type: MessageType;
  name: string;
  seq: number;
  streamId: string;
  value: any;
  qos: QoS;
  route: Transport[];
  auth: {
    id: string;
    token: string;
    nonce: string;
    ts: number;
    exp: number;
    sig: string;
  } | null;
  meta: {
    deviceId?: string;
    platform?: string;
  };
}

export interface PacketRecord {
  id: number;
  device_id: string;
  msg_id: string;
  stream_id: string;
  type: string;
  name: string;
  seq: number;
  qos: number;
  transport: Transport;
  size: number;
  received_at: number;
  rtt_ms?: number;
  status: 'ok' | 'dropped' | 'reorder' | 'replay';
  payload: any;
}

export interface Device {
  id: string;
  name: string;
  platform: string;
  firmware: string;
  first_seen: number;
  last_seen: number;
  status: 'online' | 'offline' | 'degraded';
  metadata: {
    location?: string;
    battery?: number;
    rssi?: number;
  };
}

export interface TransportMetricsPoint {
  id: number;
  device_id: string;
  transport: Transport;
  ts: number;
  rtt_avg: number;
  rtt_p50: number;
  rtt_p95: number;
  rtt_p99: number;
  loss_rate: number;
  jitter: number;
  score: number;
}

export interface CommandRecord {
  id: number;
  device_id: string;
  command: string;
  payload: any;
  sent_at: number;
  delivered_at?: number;
  executed_at?: number;
  confirmed_at?: number;
  status: 'sent' | 'delivered' | 'executed' | 'confirmed' | 'failed';
}