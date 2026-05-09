import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../services/api';
import type { RuleFlow, RuleRunLog } from '../types/udcp';

interface RuleStore {
  flowsByDevice: Record<string, RuleFlow[]>;
  activeRuleId: string | null;
  runLogsByRule: Record<string, RuleRunLog[]>;
  loading: boolean;
  error: string | null;
  
  loadFlows: (deviceId: string) => Promise<void>;
  loadFlow: (deviceId: string, ruleId: string) => Promise<RuleFlow>;
  saveFlow: (deviceId: string, flow: { ruleId?: string; name: string; nodes: any[]; edges: any[]; version?: number }) => Promise<RuleFlow>;
  deleteFlow: (deviceId: string, ruleId: string) => Promise<void>;
  
  setActiveRule: (ruleId: string | null) => void;
  
  loadRunLogs: (deviceId: string, ruleId: string) => Promise<void>;
  appendRunLog: (log: RuleRunLog) => void;
}

export const useRuleStore = create<RuleStore>()(
  devtools((set, get) => ({
    flowsByDevice: {},
    activeRuleId: null,
    runLogsByRule: {},
    loading: false,
    error: null,
    
    loadFlows: async (deviceId) => {
      set({ loading: true, error: null });
      try {
        const flows = await api.loadRules(deviceId);
        set(state => ({
          flowsByDevice: { ...state.flowsByDevice, [deviceId]: flows },
          loading: false
        }));
      } catch (e: any) {
        set({ error: e.message, loading: false });
      }
    },
    
    loadFlow: async (deviceId, ruleId) => {
      const flow = await api.loadRule(deviceId, ruleId);
      set(state => {
        const list = state.flowsByDevice[deviceId] || [];
        const idx = list.findIndex(f => f.rule_id === ruleId);
        const nextList = idx >= 0 ? [...list] : [...list, flow];
        if (idx >= 0) nextList[idx] = flow;
        return {
          flowsByDevice: { ...state.flowsByDevice, [deviceId]: nextList },
          activeRuleId: ruleId
        };
      });
      return flow;
    },
    
    saveFlow: async (deviceId, flow) => {
      const saved = await api.saveRule(deviceId, flow);
      const ruleFlow: RuleFlow = {
        rule_id: saved.ruleId,
        device_id,
        name: saved.name,
        version: saved.version,
        definition: { nodes: saved.nodes, edges: saved.edges },
        created_at: Date.now(),
        updated_at: Date.now()
      };
      set(state => {
        const list = state.flowsByDevice[deviceId] || [];
        const idx = list.findIndex(f => f.rule_id === ruleFlow.rule_id);
        const nextList = idx >= 0 ? [...list] : [...list, ruleFlow];
        if (idx >= 0) nextList[idx] = ruleFlow;
        return {
          flowsByDevice: { ...state.flowsByDevice, [deviceId]: nextList },
          activeRuleId: ruleFlow.rule_id
        };
      });
      return ruleFlow;
    },
    
    deleteFlow: async (deviceId, ruleId) => {
      await api.deleteRule(deviceId, ruleId);
      set(state => {
        const list = (state.flowsByDevice[deviceId] || []).filter(f => f.rule_id !== ruleId);
        const newFlows = { ...state.flowsByDevice, [deviceId]: list };
        const newActive = state.activeRuleId === ruleId ? null : state.activeRuleId;
        return { flowsByDevice: newFlows, activeRuleId: newActive };
      });
    },
    
    setActiveRule: (ruleId) => set({ activeRuleId: ruleId }),
    
    loadRunLogs: async (deviceId, ruleId) => {
      const logs = await api.getRuleRunLog(deviceId, ruleId);
      set(state => ({
        runLogsByRule: { ...state.runLogsByRule, [ruleId]: logs }
      }));
    },
    
    appendRunLog: (log) => {
      set(state => {
        const key = log.rule_id;
        const prev = state.runLogsByRule[key] || [];
        return {
          runLogsByRule: {
            ...state.runLogsByRule,
            [key]: [log, ...prev].slice(0, 200)
          }
        };
      });
    }
  }), { name: 'rule-store' })
);
