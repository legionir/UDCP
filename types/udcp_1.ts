export interface ReplaySession {
  id: string;
  name: string;
  device_id: string;
  start_time: number;
  end_time: number;
  created_at: number;
  duration_ms: number;
  packet_count: number;
  metadata?: any;
  packets?: ReplayPacket[];
}

export interface ReplayPacket {
  id: number;
  session_id: string;
  original_msg_id: string;
  device_id: string;
  stream_id: string;
  type: string;
  name: string;
  seq: number;
  qos: number;
  transport: 'udp' | 'ws' | 'http';
  size: number;
  timestamp: number;
  rtt_ms?: number;
  status: 'ok' | 'dropped' | 'reorder' | 'replay';
  payload: any;
}

export interface MemoryMetricsPoint {
  id: number;
  device_id: string;
  ts: number;
  free_heap_kb: number;
  min_heap_kb: number;
  fragmentation_pct: number;
  largest_free_block_kb?: number;
  watchdog_near_trigger: number;
  tasks?: any;
  queues?: any;
}

export interface StreamConfig {
  streamId: string;
  type: 'imu' | 'multi' | 'gauge' | 'audio';
  channels: string[];
  labels?: Record<string, string>;
  colors?: string[];
  unit?: string;
}
