import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// ──────────────────────────────────────────────────────────────
// Devices
// ──────────────────────────────────────────────────────────────
export async function getDevices() {
  const res = await api.get('/devices');
  return res.data as import('../types/udcp').Device[];
}

export async function getDevice(id: string) {
  const res = await api.get(`/devices/${id}`);
  return res.data as import('../types/udcp').Device;
}

// ──────────────────────────────────────────────────────────────
// Packets
// ──────────────────────────────────────────────────────────────
export async function getPackets(params?: {
  deviceId?: string;
  streamId?: string;
  transport?: string;
  type?: string;
  limit?: number;
}) {
  const res = await api.get('/packets', { params });
  return res.data as import('../types/udcp').PacketRecord[];
}

export async function exportPackets(params?: any) {
  const res = await api.get('/packets/export', { params, responseType: 'blob' });
  return res.data as Blob;
}

// ──────────────────────────────────────────────────────────────
// Metrics
// ──────────────────────────────────────────────────────────────
export async function getTransportMetrics(deviceId: string, duration = '5m') {
  const res = await api.get(`/metrics/transport/${deviceId}`, { params: { duration } });
  return res.data as import('../types/udcp').TransportMetricsPoint[];
}

export async function getLatestMetrics(deviceId: string) {
  const res = await api.get(`/metrics/transport/${deviceId}/latest`);
  return res.data as Record<string, import('../types/udcp').TransportMetricsPoint>;
}

// ──────────────────────────────────────────────────────────────
// Commands
// ──────────────────────────────────────────────────────────────
export async function sendCommand(deviceId: string, command: {
  command: string;
  payload: any;
  qos: 2;
}) {
  const res = await api.post(`/commands/${deviceId}`, command);
  return res.data as import('../types/udcp').CommandRecord;
}

export async function getCommandHistory(deviceId: string) {
  const res = await api.get(`/commands/${deviceId}/history`);
  return res.data as import('../types/udcp').CommandRecord[];
}

// ──────────────────────────────────────────────────────────────
// State
// ──────────────────────────────────────────────────────────────
export async function getDeviceState(deviceId: string, streamId?: string) {
  const res = await api.get('/state', { params: { deviceId, streamId } });
  return res.data;
}
