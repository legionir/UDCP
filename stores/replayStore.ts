import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../services/api';
import type { ReplaySession, ReplayPacket } from '../types/udcp';

interface ReplayStore {
  sessions: ReplaySession[];
  currentSession: ReplaySession | null;
  loading: boolean;
  error: string | null;
  
  listSessions: (deviceId?: string) => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  createSession: (payload: { name: string; deviceId: string; startTime: number; endTime: number; metadata?: any }) => Promise<ReplaySession>;
  exportSession: (id: string) => Promise<void>;
  
  // Playback state
  currentTime: number;
  playbackSpeed: number;
  isPlaying: boolean;
  networkSim: { latency: number; loss: number; jitter: number };
  
  setCurrentTime: (t: number) => void;
  setPlaybackSpeed: (s: number) => void;
  setIsPlaying: (v: boolean) => void;
  setNetworkSim: (cfg: Partial<ReplayStore['networkSim']>) => void;
  resetPlayback: () => void;
}

export const useReplayStore = create<ReplayStore>()(
  devtools((set, get) => ({
    sessions: [],
    currentSession: null,
    loading: false,
    error: null,
    
    currentTime: 0,
    playbackSpeed: 1,
    isPlaying: false,
    networkSim: { latency: 0, loss: 0, jitter: 0 },
    
    listSessions: async (deviceId) => {
      set({ loading: true, error: null });
      try {
        const sessions = await api.listReplaySessions(deviceId);
        set({ sessions, loading: false });
      } catch (e: any) {
        set({ error: e.message, loading: false });
      }
    },
    
    loadSession: async (id) => {
      set({ loading: true, error: null });
      try {
        const session = await api.getReplaySession(id);
        set({
          currentSession: session,
          currentTime: session.start_time,
          loading: false
        });
      } catch (e: any) {
        set({ error: e.message, loading: false });
      }
    },
    
    createSession: async (payload) => {
      const session = await api.createReplaySession(payload);
      await get().listSessions(payload.deviceId);
      return session;
    },
    
    exportSession: async (id) => {
      const blob = await api.exportReplaySession(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `replay_${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    
    setCurrentTime: (t) => set({ currentTime: t }),
    setPlaybackSpeed: (s) => set({ playbackSpeed: s }),
    setIsPlaying: (v) => set({ isPlaying: v }),
    setNetworkSim: (cfg) => set(state => ({ networkSim: { ...state.networkSim, ...cfg } })),
    resetPlayback: () => set(state => ({
      currentTime: state.currentSession?.start_time || 0,
      isPlaying: false,
      playbackSpeed: 1,
      networkSim: { latency: 0, loss: 0, jitter: 0 }
    }))
  }), { name: 'replay-store' })
);