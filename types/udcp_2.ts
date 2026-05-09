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
  preferred_transport?: ('udp'|'ws'|'http')[];
  qos?: 2;
  msg_id?: string;
  delivered_transport?: string;
  executed_transport?: string;
  confirmed_transport?: string;
  delivered_msg_id?: string;
  executed_msg_id?: string;
  confirmed_msg_id?: string;
  delivery_rtt_ms?: number;
  execution_rtt_ms?: number;
  confirmation_rtt_ms?: number;
  error_code?: string;
  error_message?: string;
}

export interface RuleFlowDefinition {
  nodes: Array<{
    id: string;
    type: 'sensor' | 'condition' | 'action' | 'transform';
    position: { x: number; y: number };
    data: any;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    data?: any;
  }>;
}

export interface RuleFlow {
  rule_id: string;
  device_id: string;
  name: string;
  version: number;
  definition: RuleFlowDefinition;
  created_at: number;
  updated_at: number;
}

export interface RuleRunLog {
  id: number;
  rule_id: string;
  device_id: string;
  ts: number;
  trigger_packet_msg_id?: string;
  result: 'ok' | 'error' | 'condition_false';
  details: any;
}
