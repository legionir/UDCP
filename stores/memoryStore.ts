import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../services/api';
import type { MemoryMetricsPoint } from '../types/udcp';

interface MemoryStore {
  latestByDevice: Record<string, MemoryMetricsPoint | null>;
  historyByDevice: Record<string, MemoryMetricsPoint[]>;
  loading: boolean;
  error: string | null;
  
  fetchLatest: (deviceId: string) => Promise<void>;
  fetchHistory: (deviceId: string, duration?: string) => Promise<void>;
}

export const useMemoryStore = create<MemoryStore>()(
  devtools((set, get) => ({
    latestByDevice: {},
    historyByDevice: {},
    loading: false,
    error: null,
    
    fetchLatest: async (deviceId) => {
      try {
        const latest = await api.getLatestMemory(deviceId);
        set(state => ({ latestByDevice: { ...state.latestByDevice, [deviceId]: latest } }));
      } catch (e: any) {
        set({ error: e.message });
      }
    },
    
    fetchHistory: async (deviceId, duration = '5m') => {
      set({ loading: true, error: null });
      try {
        const history = await api.getMemoryHistory(deviceId, duration);
        set(state => ({
          historyByDevice: { ...state.historyByDevice, [deviceId]: history },
          loading: false
        }));
      } catch (e: any) {
        set({ error: e.message, loading: false });
      }
    }
  }), { name: 'memory-store' })
);

