// Commands
export async function sendCommand(deviceId: string, payload: {
  command: string;
  payload: any;
  qos?: 2;
  preferredTransport?: ('udp'|'ws'|'http')[];
}) {
  const res = await api.post(`/commands/${deviceId}`, { ...payload, qos: payload.qos ?? 2 });
  return res.data as import('../types/udcp').CommandRecord;
}

export async function getCommandHistory(deviceId: string) {
  const res = await api.get(`/commands/${deviceId}/history`);
  return res.data as import('../types/udcp').CommandRecord[];
}

export async function getCommand(deviceId: string, id: number) {
  const res = await api.get(`/commands/${deviceId}/${id}`);
  return res.data as import('../types/udcp').CommandRecord;
}

// Rule Engine
export async function saveRule(deviceId: string, rule: {
  ruleId?: string;
  name: string;
  nodes: any[];
  edges: any[];
  version?: number;
}) {
  const res = await api.post(`/rules/${deviceId}`, rule);
  return res.data as { ruleId: string; name: string; version: number; nodes: any[]; edges: any[] };
}

export async function loadRules(deviceId: string) {
  const res = await api.get(`/rules/${deviceId}`);
  return res.data as Array<{ rule_id: string; name: string; version: number; definition: { nodes: any[]; edges: any[] }; created_at: number; updated_at: number }>;
}

export async function loadRule(deviceId: string, ruleId: string) {
  const res = await api.get(`/rules/${deviceId}/${ruleId}`);
  return res.data as { rule_id: string; name: string; version: number; definition: { nodes: any[]; edges: any[] }; created_at: number; updated_at: number };
}

export async function deleteRule(deviceId: string, ruleId: string) {
  const res = await api.delete(`/rules/${deviceId}/${ruleId}`);
  return res.data;
}

export async function logRuleRun(deviceId: string, ruleId: string, payload: {
  trigger_packet_msg_id?: string;
  result: 'ok' | 'error' | 'condition_false';
  details?: any;
}) {
  const res = await api.post(`/rules/${deviceId}/${ruleId}/run-log`, payload);
  return res.data;
}

export async function getRuleRunLog(deviceId: string, ruleId: string) {
  const res = await api.get(`/rules/${deviceId}/${ruleId}/run-log`);
  return res.data as Array<{
    id: number;
    rule_id: string;
    device_id: string;
    ts: number;
    trigger_packet_msg_id?: string;
    result: string;
    details: any;
  }>;
}
