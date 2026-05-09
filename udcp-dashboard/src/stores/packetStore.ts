import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../services/api';
import type { PacketRecord } from '../types/udcp';

interface PacketStore {
  packets: PacketRecord[];
  loading: boolean;
  error: string | null;
  filters: {
    deviceId?: string;
    streamId?: string;
    transport?: string;
    type?: string;
  };
  
  fetchPackets: (params?: any) => Promise<void>;
  addPacket: (packet: PacketRecord) => void;
  setFilters: (filters: Partial<PacketStore['filters']>) => void;
  clear: () => void;
}

export const usePacketStore = create<PacketStore>()(
  devtools((set, get) => ({
    packets: [],
    loading: false,
    error: null,
    filters: {},
    
    fetchPackets: async (params = {}) => {
      set({ loading: true, error: null });
      try {
        const filters = { ...get().filters, ...params };
        const packets = await api.getPackets(filters);
        set({ packets, loading: false });
      } catch (err: any) {
        set({ error: err.message, loading: false });
      }
    },
    
    addPacket: (packet) => {
      set(state => ({
        packets: [packet, ...state.packets].slice(0, 2000) // Keep last 2000
      }));
    },
    
    setFilters: (filters) => {
      set(state => ({ filters: { ...state.filters, ...filters } }));
      // Auto-fetch with new filters
      get().fetchPackets(filters);
    },
    
    clear: () => set({ packets: [] })
  }), { name: 'packet-store' })
);