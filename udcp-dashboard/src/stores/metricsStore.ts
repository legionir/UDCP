import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../services/api';
import type { TransportMetricsPoint } from '../types/udcp';

interface MetricsStore {
  metricsHistory: Record<string, TransportMetricsPoint[]>; // key: deviceId:transport
  latestMetrics: Record<string, TransportMetricsPoint>;
  loading: boolean;
  error: string | null;
  
  fetchLatest: (deviceId: string) => Promise<void>;
  fetchHistory: (deviceId: string, duration?: string) => Promise<void>;
}

export const useMetricsStore = create<MetricsStore>()(
  devtools((set, get) => ({
    metricsHistory: {},
    latestMetrics: {},
    loading: false,
    error: null,
    
    fetchLatest: async (deviceId) => {
      try {
        const latest = await api.getLatestMetrics(deviceId);
        set(state => ({
          latestMetrics: { ...state.latestMetrics, [deviceId]: latest }
        }));
      } catch (err: any) {
        set({ error: err.message });
      }
    },
    
    fetchHistory: async (deviceId, duration = '5m') => {
      set({ loading: true, error: null });
      try {
        const history = await api.getTransportMetrics(deviceId, duration);
        set(state => ({
          metricsHistory: {
            ...state.metricsHistory,
            [deviceId]: history
          },
          loading: false
        }));
      } catch (err: any) {
        set({ error: err.message, loading: false });
      }
    }
  }), { name: 'metrics-store' })
);