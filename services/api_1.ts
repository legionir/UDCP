// Replay
export async function createReplaySession(payload: {
  name: string; deviceId: string; startTime: number; endTime: number; metadata?: any;
}) {
  const res = await api.post('/replay/sessions', payload);
  return res.data as { id: string; name: string; deviceId: string; startTime: number; endTime: number; durationMs: number; packetCount: number };
}

export async function getReplaySession(id: string) {
  const res = await api.get(`/replay/sessions/${id}`);
  return res.data as import('../types/udcp').ReplaySession;
}

export async function listReplaySessions(deviceId?: string) {
  const res = await api.get('/replay/sessions', { params: deviceId ? { deviceId } : {} });
  return res.data as import('../types/udcp').ReplaySession[];
}

export async function exportReplaySession(id: string) {
  const res = await api.get(`/replay/sessions/${id}/export`, { responseType: 'blob' });
  return res.data as Blob;
}

// Memory
export async function postMemoryMetrics(deviceId: string, payload: {
  free_heap_kb: number; min_heap_kb: number; fragmentation_pct: number;
  largest_free_block_kb?: number; watchdog_near_trigger?: boolean;
  tasks?: any; queues?: any;
}) {
  const res = await api.post(`/memory/${deviceId}`, payload);
  return res.data;
}

export async function getMemoryHistory(deviceId: string, duration = '5m') {
  const res = await api.get(`/memory/${deviceId}/history`, { params: { duration } });
  return res.data as import('../types/udcp').MemoryMetricsPoint[];
}

export async function getLatestMemory(deviceId: string) {
  const res = await api.get(`/memory/${deviceId}/latest`);
  return res.data as import('../types/udcp').MemoryMetricsPoint | null;
}
