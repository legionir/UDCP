import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../services/api';
import type { CommandRecord } from '../types/udcp';

interface CommandStore {
  historyByDevice: Record<string, CommandRecord[]>;
  loading: boolean;
  error: string | null;
  
  fetchHistory: (deviceId: string) => Promise<void>;
  sendCommand: (deviceId: string, payload: {
    command: string; payload: any; qos?: 2; preferredTransport?: ('udp'|'ws'|'http')[];
  }) => Promise<CommandRecord>;
  updateCommandFromEvent: (cmd: CommandRecord) => void;
}

export const useCommandStore = create<CommandStore>()(
  devtools((set, get) => ({
    historyByDevice: {},
    loading: false,
    error: null,
    
    fetchHistory: async (deviceId) => {
      set({ loading: true, error: null });
      try {
        const history = await api.getCommandHistory(deviceId);
        set(state => ({
          historyByDevice: { ...state.historyByDevice, [deviceId]: history },
          loading: false
        }));
      } catch (e: any) {
        set({ error: e.message, loading: false });
      }
    },
    
    sendCommand: async (deviceId, payload) => {
      const cmd = await api.sendCommand(deviceId, payload);
      // Optimistic prepend
      set(state => {
        const prev = state.historyByDevice[deviceId] || [];
        return {
          historyByDevice: {
            ...state.historyByDevice,
            [deviceId]: [cmd, ...prev].slice(0, 200)
          }
        };
      });
      return cmd;
    },
    
    updateCommandFromEvent: (cmdEvent) => {
      const deviceId = cmdEvent.device_id;
      set(state => {
        const prev = state.historyByDevice[deviceId] || [];
        const idx = prev.findIndex(c => c.id === cmdEvent.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...cmdEvent };
          return { historyByDevice: { ...state.historyByDevice, [deviceId]: next } };
        } else {
          // New command (rare but safe)
          return {
            historyByDevice: {
              ...state.historyByDevice,
              [deviceId]: [cmdEvent, ...prev].slice(0, 200)
            }
          };
        }
      });
    }
  }), { name: 'command-store' })
);