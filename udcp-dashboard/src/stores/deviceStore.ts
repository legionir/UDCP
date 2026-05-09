import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../services/api';
import type { Device } from '../types/udcp';

interface DeviceStore {
  devices: Device[];
  selectedDeviceId: string | null;
  loading: boolean;
  error: string | null;
  
  fetchDevices: () => Promise<void>;
  setSelectedDevice: (id: string | null) => void;
  updateDeviceStatus: (id: string, status: Device['status']) => void;
}

export const useDeviceStore = create<DeviceStore>()(
  devtools((set, get) => ({
    devices: [],
    selectedDeviceId: null,
    loading: false,
    error: null,
    
    fetchDevices: async () => {
      set({ loading: true, error: null });
      try {
        const devices = await api.getDevices();
        set({ devices, loading: false });
        
        // Auto-select first online device
        const online = devices.find(d => d.status === 'online');
        if (online && !get().selectedDeviceId) {
          set({ selectedDeviceId: online.id });
        }
      } catch (err: any) {
        set({ error: err.message, loading: false });
      }
    },
    
    setSelectedDevice: (id) => set({ selectedDeviceId: id }),
    
    updateDeviceStatus: (id, status) => {
      set(state => ({
        devices: state.devices.map(d => d.id === id ? { ...d, status, last_seen: Date.now() } : d)
      }));
    }
  }), { name: 'device-store' })
);