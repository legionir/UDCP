import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { VirtualModule, ModuleType } from '../types/udcp';

interface VirtualHardwareStore {
  modules: VirtualModule[];
  selectedModuleId: string | null;
  
  addModule: (type: ModuleType, position?: { x: number; y: number }) => VirtualModule;
  updateModule: (id: string, patch: Partial<VirtualModule>) => void;
  removeModule: (id: string) => void;
  moveModule: (id: string, position: { x: number; y: number }) => void;
  
  exportWorkspace: () => string;
  importWorkspace: (json: string) => void;
  clearWorkspace: () => void;
}

export const useVirtualHardwareStore = create<VirtualHardwareStore>()(
  devtools(
    persist(
      (set, get) => ({
        modules: [],
        selectedModuleId: null,
        
        addModule: (type, position = { x: 100 + Math.random()*200, y: 100 + Math.random()*200 }) => {
          const id = uuidv4();
          const defaults: Record<ModuleType, Partial<VirtualModule>> = {
            joystick: {
              name: 'Joystick',
              config: { autoSend: true, rate: 120, transport: ['udp'], qos: 0, streamName: 'stick' },
              state: { x: 0, y: 0 }
            },
            slider: {
              name: 'Slider',
              config: { autoSend: true, rate: 60, transport: ['ws'], qos: 0, streamName: 'slider' },
              state: { value: 0.5 }
            },
            button: {
              name: 'Button',
              config: { autoSend: true, rate: 10, transport: ['ws'], qos: 0, streamName: 'button' },
              state: { pressed: false }
            },
            color_picker: {
              name: 'Color Picker',
              config: { autoSend: true, rate: 30, transport: ['ws'], qos: 0, streamName: 'color_picker' },
              state: { r: 255, g: 165, b: 0 }
            },
            piano: {
              name: 'Piano',
              config: { autoSend: true, rate: 60, transport: ['ws'], qos: 0, streamName: 'midi' },
              state: { note: null, velocity: 0 }
            }
          };
          
          const mod: VirtualModule = {
            id,
            type,
            name: defaults[type]?.name || type,
            position,
            config: defaults[type]?.config || { autoSend: true, rate: 60, transport: ['ws'], qos: 0, streamName: type },
            state: defaults[type]?.state || {}
          };
          
          set(state => ({ modules: [...state.modules, mod], selectedModuleId: id }));
          return mod;
        },
        
        updateModule: (id, patch) => {
          set(state => ({
            modules: state.modules.map(m => m.id === id ? { ...m, ...patch, config: { ...m.config, ...(patch.config || {}) }, state: { ...m.state, ...(patch.state || {}) } } : m)
          }));
        },
        
        removeModule: (id) => {
          set(state => ({
            modules: state.modules.filter(m => m.id !== id),
            selectedModuleId: state.selectedModuleId === id ? null : state.selectedModuleId
          }));
        },
        
        moveModule: (id, position) => {
          set(state => ({
            modules: state.modules.map(m => m.id === id ? { ...m, position } : m)
          }));
        },
        
        exportWorkspace: () => {
          const state = get();
          return JSON.stringify({
            version: 1,
            exportedAt: Date.now(),
            modules: state.modules
          }, null, 2);
        },
        
        importWorkspace: (json) => {
          try {
            const data = JSON.parse(json);
            if (Array.isArray(data.modules)) {
              // Assign new IDs to avoid collisions
              const imported = data.modules.map((m: VirtualModule) => ({
                ...m,
                id: uuidv4(),
                position: m.position || { x: 100, y: 100 }
              }));
              set({ modules: imported, selectedModuleId: imported[0]?.id || null });
            }
          } catch (e) {
            console.error('Invalid workspace JSON', e);
          }
        },
        
        clearWorkspace: () => set({ modules: [], selectedModuleId: null })
      }),
      { name: 'udcp-virtual-hardware' }
    )
  )
);


