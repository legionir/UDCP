import { useEffect, useRef } from 'react';
import { useUdcpStream } from './useUdcpStream';
import { useRuleStore } from '../stores/ruleStore';
import { useDeviceStore } from '../stores/deviceStore';
import { api } from '../services/api';
import type { RuleFlow } from '../types/udcp';

/**
 * Rule execution engine:
 * - Listens to realtime stream packets (packet:${deviceId}:${streamId})
 * - Evaluates flows (nodes: Sensor/Condition/Action/Transform)
 * - Executes actions (sendCommand) when conditions match
 * - Logs run results via /rules/:deviceId/:ruleId/run-log
 */
export function useRuleRunner(deviceId?: string) {
  const { flowsByDevice, activeRuleId, appendRunLog } = useRuleStore();
  const { selectedDeviceId } = useDeviceStore();
  const activeDeviceId = deviceId || selectedDeviceId;
  
  // Track last values per sensor node (cache)
  const lastValuesRef = useRef<Map<string, number>>(new Map());
  
  // Load flows for active device
  useEffect(() => {
    if (!activeDeviceId) return;
    useRuleStore.getState().loadFlows(activeDeviceId);
  }, [activeDeviceId]);
  
  // Subscribe to ALL stream packets for this device (we'll filter by streamId in logic)
  const { data: packetEvents } = useUdcpStream({
    channel: 'packets',
    deviceId: activeDeviceId || undefined,
    bufferSize: 500
  });
  
  // Main rule evaluation loop
  useEffect(() => {
    if (!packetEvents || packetEvents.length === 0 || !activeDeviceId) return;
    
    const latestPacket = packetEvents[0] as any;
    if (latestPacket?.type !== 'stream') return;
    
    const streamId = latestPacket.stream_id as string;
    const valueMap = latestPacket.payload as Record<string, number> || {};
    
    // Update last value cache for this stream
    Object.entries(valueMap).forEach(([k, v]) => {
      if (typeof v === 'number') {
        lastValuesRef.current.set(`${streamId}:${k}`, v as number);
      }
    });
    
    // Evaluate ALL rules for this device
    const flows = flowsByDevice[activeDeviceId] || [];
    for (const flow of flows) {
      if (!flow?.definition?.nodes?.length) continue;
      
      try {
        evaluateFlow(flow, streamId, valueMap, activeDeviceId!, appendRunLog);
      } catch (err) {
        console.error('[RuleRunner] Error evaluating', flow.rule_id, err);
        api.logRuleRun(activeDeviceId!, flow.rule_id, {
          trigger_packet_msg_id: latestPacket.msg_id,
          result: 'error',
          details: { error: String(err) }
        }).catch(() => {});
      }
    }
  }, [packetEvents, flowsByDevice, activeDeviceId, appendRunLog]);
  
  return { lastValuesRef };
}

/**
 * Evaluate a single RuleFlow against incoming stream value
 */
async function evaluateFlow(
  flow: RuleFlow,
  incomingStreamId: string,
  incomingValues: Record<string, number>,
  deviceId: string,
  appendRunLog: (log: any) => void
) {
  const { nodes, edges } = flow.definition;
  
  // Build node lookup
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  // Find all sensor nodes that are currently "active" (their streamId matches incoming)
  const sensorNodes = nodes.filter(n => n.type === 'sensor');
  
  // Check if any sensor node is listening to our incoming stream
  const relevantSensors = sensorNodes.filter(sn => sn.data?.streamId === incomingStreamId);
  if (relevantSensors.length === 0) return;
  
  // For simplicity: evaluate flow starting from relevant sensors
  // This is a basic topological evaluation (data flows along edges)
  
  // Collect current values at sensor outputs
  const context: Record<string, any> = {};
  
  // Evaluate each sensor node -> its output is its selected field value
  for (const sn of relevantSensors) {
    const field = sn.data?.field as string;
    const val = incomingValues?.[field];
    if (typeof val === 'number') {
      context[sn.id] = val;
    }
  }
  
  // Traverse edges and propagate values (simple forward propagation)
  // BFS/DFS to compute downstream nodes
  const visited = new Set<string>();
  const queue: string[] = [...relevantSensors.map(s => s.id)];
  const computed: Record<string, any> = { ...context };
  
  let changed = true;
  let iterations = 0;
  while (queue.length > 0 && iterations < 100) {
    const currentNodeId = queue.shift()!;
    visited.add(currentNodeId);
    
    // Find outgoing edges from currentNodeId
    const outEdges = edges.filter(e => e.source === currentNodeId);
    for (const edge of outEdges) {
      const targetNode = nodeMap.get(edge.target);
      if (!targetNode) continue;
      
      // Compute value for target node based on source value + transform/condition logic
      let valueToPropagate = computed[currentNodeId];
      
      // If target is transform node -> apply transform
      if (targetNode.type === 'transform') {
        valueToPropagate = applyTransform(valueToPropagate, targetNode.data);
      }
      
      computed[targetNode.id] = valueToPropagate;
      
      if (!visited.has(targetNode.id)) {
        queue.push(targetNode.id);
      }
    }
    iterations++;
  }
  
  // Find condition nodes and evaluate them
  const conditionNodes = nodes.filter(n => n.type === 'condition');
  const conditionResults: Record<string, boolean> = {};
  
  for (const cn of conditionNodes) {
    const inputVal = computed[cn.id] ?? computed[ getSourceValueNodeId(cn.id, edges, nodeMap) ?? '' ];
    const op = cn.data?.operator as string;
    const valRef = Number(cn.data?.value ?? 0);
    const inputNum = Number(inputVal);
    
    let pass = false;
    if (isNaN(inputNum) || isNaN(valRef)) pass = false;
    else {
      switch (op) {
        case '>': pass = inputNum > valRef; break;
        case '<': pass = inputNum < valRef; break;
        case '>=': pass = inputNum >= valRef; break;
        case '<=': pass = inputNum <= valRef; break;
        case '==': pass = Math.abs(inputNum - valRef) < 1e-9; break;
        case '!=': pass = Math.abs(inputNum - valRef) >= 1e-9; break;
        default: pass = false;
      }
    }
    conditionResults[cn.id] = pass;
    computed[cn.id] = pass; // condition node outputs boolean
  }
  
  // Find action nodes that are downstream of conditions that passed
  const actionNodes = nodes.filter(n => n.type === 'action');
  for (const an of actionNodes) {
    // Check if there exists a path from any condition node to this action (via edges)
    const isTriggered = isConditionPathSatisfied(an.id, edges, nodeMap, conditionResults);
    if (!isTriggered) continue;
    
    // Execute action: send command to device
    const cmdName = an.data?.command as string;
    const payload = an.data?.payload ? JSON.parse(JSON.stringify(an.data.payload)) : {};
    
    try {
      const sentCmd = await api.sendCommand(deviceId, {
        command: cmdName,
        payload,
        qos: 2,
        preferredTransport: ['ws','http']
      });
      
      // Log rule run: ok
      await api.logRuleRun(deviceId, flow.rule_id, {
        trigger_packet_msg_id: incomingPacketMsgIdFromContext(latestPacketEventsForRule()),
        result: 'ok',
        details: {
          actionNodeId: an.id,
          command: cmdName,
          payload,
          commandId: sentCmd.id
        }
      });
      
      appendRunLog({
        id: Date.now(),
        rule_id: flow.rule_id,
        device_id: deviceId,
        ts: Date.now(),
        trigger_packet_msg_id: latestPacketEventsForRule()?.msg_id,
        result: 'ok',
        details: { actionNodeId: an.id, command: cmdName }
      });
      
    } catch (err: any) {
      await api.logRuleRun(deviceId, flow.rule_id, {
        trigger_packet_msg_id: latestPacketEventsForRule()?.msg_id,
        result: 'error',
        details: { actionNodeId: an.id, error: err.message }
      });
      appendRunLog({
        id: Date.now(),
        rule_id: flow.rule_id,
        device_id: deviceId,
        ts: Date.now(),
        trigger_packet_msg_id: latestPacketEventsForRule()?.msg_id,
        result: 'error',
        details: { actionNodeId: an.id, error: err.message }
      });
    }
  }
}

// Helper functions (simplified)
let _latestPacketCache: any = null;
function latestPacketEventsForRule() { return _latestPacketCache; }

function getSourceValueNodeId(targetNodeId: string, edges: any[], nodeMap: Map<string, any>): string | null {
  const inEdge = edges.find(e => e.target === targetNodeId);
  return inEdge ? inEdge.source : null;
}

function applyTransform(value: any, data: any): any {
  if (!data || !data.op) return value;
  const v = Number(value);
  if (isNaN(v)) return value;
  switch (data.op) {
    case 'scale': return v * (Number(data.factor) || 1);
    case 'offset': return v + (Number(data.offset) || 0);
    case 'map': {
      // map [inMin,inMax] -> [outMin,outMax]
      const inMin = Number(data.inMin ?? 0), inMax = Number(data.inMax ?? 1);
      const outMin = Number(data.outMin ?? 0), outMax = Number(data.outMax ?? 1);
      const t = (v - inMin) / (inMax - inMin || 1);
      return outMin + t * (outMax - outMin);
    }
    case 'avg_window': {
      // simple moving average buffer (in real impl use ref)
      return v; // placeholder
    }
    default: return v;
  }
}

function isConditionPathSatisfied(actionNodeId: string, edges: any[], nodeMap: Map<string, any>, conditionResults: Record<string, boolean>): boolean {
  // DFS to check if there exists ANY path from a condition node to actionNodeId
  const visited = new Set<string>();
  const stack: string[] = [actionNodeId];
  
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    
    // Find incoming edges
    const inEdges = edges.filter(e => e.target === cur);
    for (const e of inEdges) {
      const src = e.source;
      const srcNode = nodeMap.get(src);
      if (!srcNode) continue;
      if (srcNode.type === 'condition') {
        // The condition result must be true
        if (conditionResults[src] === true) return true;
      }
      stack.push(src);
    }
  }
  return false;
}
