import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  Edge,
  Node,
  NodeTypes,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { useRuleStore } from '../../stores/ruleStore';
import { useDeviceStore } from '../../stores/deviceStore';
import { useUdcpStream } from '../../hooks/useUdcpStream';
import { useRuleRunner } from '../../hooks/useRuleRunner';
import { api } from '../../services/api';

// ──────────────────────────────────────────────────────────────
// CUSTOM NODES
// ──────────────────────────────────────────────────────────────

function SensorNode({ data, id }: any) {
  return (
    <div className="bg-blue-700 border-2 border-blue-400 rounded-lg p-2 min-w-[180px] shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-gray-300" />
      <div className="flex items-center gap-2">
        <div className="text-xs bg-blue-900 px-2 py-0.5 rounded">🧠 SENSOR</div>
        <div className="font-bold text-sm">{data.label || 'Sensor'}</div>
      </div>
      
      <div className="mt-2 space-y-1">
        <div>
          <label className="text-xs text-gray-200 block">Stream</label>
          <select 
            className="w-full bg-gray-900 text-xs p-1 rounded"
            value={data.streamId || 'motion-imu'}
            onChange={e => data.onChange?.({ streamId: e.target.value })}
          >
            <option value="motion-imu">motion-imu</option>
            <option value="light">light</option>
            <option value="stick">stick</option>
            <option value="slider">slider</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-200 block">Field</label>
          <select 
            className="w-full bg-gray-900 text-xs p-1 rounded"
            value={data.field || 'ax'}
            onChange={e => data.onChange?.({ field: e.target.value })}
          >
            {/* Common fields for motion-imu */}
            <option value="ax">ax</option>
            <option value="ay">ay</option>
            <option value="az">az</option>
            <option value="gx">gx</option>
            <option value="gy">gy</option>
            <option value="gz">gz</option>
            {/* For light */}
            <option value="lux">lux</option>
            {/* For stick */}
            <option value="x">x</option>
            <option value="y">y</option>
          </select>
        </div>
      </div>
      
      <Handle type="source" position={Position.Right} className="!bg-gray-300" />
    </div>
  );
}

function ConditionNode({ data, id }: any) {
  return (
    <div className="bg-amber-700 border-2 border-amber-400 rounded-lg p-2 min-w-[180px] shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-gray-300" />
      <div className="flex items-center gap-2">
        <div className="text-xs bg-amber-900 px-2 py-0.5 rounded">🔍 CONDITION</div>
        <div className="font-bold text-sm">{data.label || 'Condition'}</div>
      </div>
      
      <div className="mt-2 flex items-center gap-2">
        <select 
          className="bg-gray-900 text-xs p-1 rounded"
          value={data.operator || '>'}
          onChange={e => data.onChange?.({ operator: e.target.value })}
        >
          <option value=">">{'>'}</option>
          <option value="<">{'<'}</option>
          <option value=">=">{'>='}</option>
          <option value="<=">{'<='}</option>
          <option value="==">==</option>
          <option value="!=">!=</option>
        </select>
        
        <input 
          type="number"
          className="w-24 bg-gray-900 text-xs p-1 rounded"
          value={data.value ?? 0}
          step="0.01"
          onChange={e => data.onChange?.({ value: Number(e.target.value) })}
        />
      </div>
      
      <div className="mt-1 text-xs text-gray-200">
        Input: <span className="font-mono text-amber-200">{data.inputLabel || 'value'}</span>
      </div>
      
      <Handle type="source" position={Position.Right} className="!bg-gray-300" />
    </div>
  );
}

function ActionNode({ data, id }: any) {
  return (
    <div className="bg-green-700 border-2 border-green-400 rounded-lg p-2 min-w-[200px] shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-gray-300" />
      <div className="flex items-center gap-2">
        <div className="text-xs bg-green-900 px-2 py-0.5 rounded">⚡ ACTION</div>
        <div className="font-bold text-sm">{data.label || 'Action'}</div>
      </div>
      
      <div className="mt-2 space-y-1">
        <div>
          <label className="text-xs text-gray-200 block">Command</label>
          <select 
            className="w-full bg-gray-900 text-xs p-1 rounded"
            value={data.command || 'led'}
            onChange={e => data.onChange?.({ command: e.target.value })}
          >
            <option value="led">led</option>
            <option value="restart">restart</option>
            <option value="ota">ota</option>
            <option value="sync_time">sync_time</option>
            <option value="alert">alert</option>
            <option value="force_transport">force_transport</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-200 block">Payload (JSON)</label>
          <textarea 
            className="w-full bg-black text-green-300 font-mono text-xs p-1 rounded h-16"
            value={typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload || { state: true }, null, 2)}
            onChange={e => {
              try {
                const parsed = JSON.parse(e.target.value || '{}');
                data.onChange?.({ payload: parsed });
              } catch {
                data.onChange?.({ payload: e.target.value }); // allow string for flexibility
              }
            }}
            spellCheck={false}
          />
        </div>
      </div>
      
      <Handle type="source" position={Position.Right} className="!bg-gray-300" />
    </div>
  );
}

function TransformNode({ data, id }: any) {
  return (
    <div className="bg-purple-700 border-2 border-purple-400 rounded-lg p-2 min-w-[180px] shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-gray-300" />
      <div className="flex items-center gap-2">
        <div className="text-xs bg-purple-900 px-2 py-0.5 rounded">🔧 TRANSFORM</div>
        <div className="font-bold text-sm">{data.label || 'Transform'}</div>
      </div>
      
      <div className="mt-2 space-y-1">
        <div>
          <label className="text-xs text-gray-200 block">Operation</label>
          <select 
            className="w-full bg-gray-900 text-xs p-1 rounded"
            value={data.op || 'scale'}
            onChange={e => data.onChange?.({ op: e.target.value })}
          >
            <option value="scale">scale (× factor)</option>
            <option value="offset">offset (+ offset)</option>
            <option value="map">map [in→out]</option>
            <option value="avg_window">avg_window (N)</option>
          </select>
        </div>
        
        {data.op === 'scale' && (
          <div>
            <label className="text-xs text-gray-200 block">Factor</label>
            <input 
              type="number" step="0.1"
              className="w-full bg-gray-900 text-xs p-1 rounded"
              value={data.factor ?? 1}
              onChange={e => data.onChange?.({ factor: Number(e.target.value) })}
            />
          </div>
        )}
        
        {data.op === 'offset' && (
          <div>
            <label className="text-xs text-gray-200 block">Offset</label>
            <input 
              type="number" step="0.01"
              className="w-full bg-gray-900 text-xs p-1 rounded"
              value={data.offset ?? 0}
              onChange={e => data.onChange?.({ offset: Number(e.target.value) })}
            />
          </div>
        )}
        
        {data.op === 'map' && (
          <div className="grid grid-cols-2 gap-1">
            <div>
              <label className="text-xs text-gray-200 block">inMin</label>
              <input type="number" className="w-full bg-gray-900 text-xs p-1 rounded" value={data.inMin ?? 0} onChange={e=>data.onChange?.({inMin:Number(e.target.value)})}/>
            </div>
            <div>
              <label className="text-xs text-gray-200 block">inMax</label>
              <input type="number" className="w-full bg-gray-900 text-xs p-1 rounded" value={data.inMax ?? 1} onChange={e=>data.onChange?.({inMax:Number(e.target.value)})}/>
            </div>
            <div>
              <label className="text-xs text-gray-200 block">outMin</label>
              <input type="number" className="w-full bg-gray-900 text-xs p-1 rounded" value={data.outMin ?? 0} onChange={e=>data.onChange?.({outMin:Number(e.target.value)})}/>
            </div>
            <div>
              <label className="text-xs text-gray-200 block">outMax</label>
              <input type="number" className="w-full bg-gray-900 text-xs p-1 rounded" value={data.outMax ?? 1} onChange={e=>data.onChange?.({outMax:Number(e.target.value)})}/>
            </div>
          </div>
        )}
        
        {data.op === 'avg_window' && (
          <div>
            <label className="text-xs text-gray-200 block">Window N</label>
            <input type="number" className="w-full bg-gray-900 text-xs p-1 rounded" value={data.window ?? 5} onChange={e=>data.onChange?.({window:Number(e.target.value)})}/>
          </div>
        )}
      </div>
      
      <Handle type="source" position={Position.Right} className="!bg-gray-300" />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  sensor: (props) => <SensorNode {...props} />,
  condition: (props) => <ConditionNode {...props} />,
  action: (props) => <ActionNode {...props} />,
  transform: (props) => <TransformNode {...props} />
};

export function RuleEngine({ deviceId }: { deviceId: string }) {
  const { selectedDeviceId } = useDeviceStore();
  const activeDeviceId = deviceId || selectedDeviceId;
  
  const { flowsByDevice, loadFlows, saveFlow, loadFlow, deleteFlow, activeRuleId, setActiveRule, runLogsByRule, loadRunLogs } = useRuleStore();
  
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [ruleName, setRuleName] = useState('Fall Detection Rule');
  const [currentRuleId, setCurrentRuleId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Load flows for device
  useEffect(() => {
    if (!activeDeviceId) return;
    loadFlows(activeDeviceId);
  }, [activeDeviceId, loadFlows]);
  
  // Load active rule if exists
  useEffect(() => {
    if (!activeDeviceId || !activeRuleId) {
      setNodes([]);
      setEdges([]);
      setCurrentRuleId(null);
      setRuleName('Untitled Rule');
      return;
    }
    (async () => {
      const flow = await loadFlow(activeDeviceId, activeRuleId);
      setNodes(flow.definition.nodes.map(n => ({ ...n, data: { ...n.data, onChange: (patch: any) => updateNodeData(n.id, patch) } })));
      setEdges(flow.definition.edges);
      setCurrentRuleId(flow.rule_id);
      setRuleName(flow.name);
      await loadRunLogs(activeDeviceId, flow.rule_id);
    })();
  }, [activeDeviceId, activeRuleId, loadFlow, loadRunLogs]);
  
  // ReactFlow handlers
  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, id: uuidv4() }, eds)),
    []
  );
  
  // Update node data (callback passed to custom nodes)
  const updateNodeData = useCallback((nodeId: string, patch: any) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))
    );
  }, []);
  
  // Add node from palette
  const addNode = useCallback((type: 'sensor' | 'condition' | 'action' | 'transform', position: { x: number; y: number }) => {
    const id = uuidv4();
    const baseData: any = { label: `${type[0].toUpperCase() + type.slice(1)}` };
    
    if (type === 'sensor') {
      baseData.streamId = 'motion-imu';
      baseData.field = 'ax';
    }
    if (type === 'condition') {
      baseData.operator = '>';
      baseData.value = 3.0;
      baseData.inputLabel = 'value';
    }
    if (type === 'action') {
      baseData.command = 'led';
      baseData.payload = { state: true };
    }
    if (type === 'transform') {
      baseData.op = 'scale';
      baseData.factor = 1.0;
    }
    
    const newNode: Node = {
      id,
      type,
      position,
      data: {
        ...baseData,
        onChange: (patch: any) => updateNodeData(id, patch)
      }
    };
    setNodes((nds) => [...nds, newNode]);
  }, [updateNodeData]);
  
  // Validate flow
  const validateFlow = useCallback(() => {
    const errors: string[] = [];
    
    // Check for cycles (simple DFS)
    const hasCycle = (nodesList: Node[], edgesList: Edge[]) => {
      const graph: Record<string, string[]> = {};
      nodesList.forEach(n => graph[n.id] = []);
      edgesList.forEach(e => graph[e.source]?.push(e.target));
      
      const visited = new Set<string>();
      const recStack = new Set<string>();
      
      const dfs = (nodeId: string): boolean => {
        visited.add(nodeId);
        recStack.add(nodeId);
        for (const neighbor of graph[nodeId] || []) {
          if (!visited.has(neighbor) && dfs(neighbor)) return true;
          else if (recStack.has(neighbor)) return true;
        }
        recStack.delete(nodeId);
        return false;
      };
      
      for (const n of nodesList) if (!visited.has(n.id)) if (dfs(n.id)) return true;
      return false;
    };
    
    if (hasCycle(nodes, edges)) {
      errors.push('❌ Cycle detected in flow! (edges create a loop)');
    }
    
    // Check nodes without connections
    const nodeIds = new Set(nodes.map(n => n.id));
    const connectedSources = new Set(edges.map(e => e.source));
    const connectedTargets = new Set(edges.map(e => e.target));
    
    const unconnected = nodes.filter(n => !connectedSources.has(n.id) && !connectedTargets.has(n.id));
    if (unconnected.length > 0) {
      errors.push(`⚠️ ${unconnected.length} node(s) not connected: ${unconnected.map(n => n.data?.label || n.id).join(', ')}`);
    }
    
    // Check condition nodes have operator/value
    const badConditions = nodes.filter(n => n.type === 'condition' && (n.data?.operator == null || n.data?.value == null));
    if (badConditions.length > 0) {
      errors.push(`⚠️ ${badConditions.length} Condition node(s) missing operator/value`);
    }
    
    // Check action nodes have command
    const badActions = nodes.filter(n => n.type === 'action' && !n.data?.command);
    if (badActions.length > 0) {
      errors.push(`⚠️ ${badActions.length} Action node(s) missing command`);
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  }, [nodes, edges]);
  
  // Save flow
  const onSave = async () => {
    if (!activeDeviceId) return alert('No device selected');
    if (!validateFlow()) {
      if (!confirm('Flow has warnings/errors. Save anyway?')) return;
    }
    const flow = await saveFlow(activeDeviceId, {
      ruleId: currentRuleId || undefined,
      name: ruleName,
      nodes,
      edges,
      version: 1
    });
    setCurrentRuleId(flow.rule_id);
    alert(`✅ Rule saved: ${flow.name} (id: ${flow.rule_id})`);
  };
  
  // Load existing flow from list
  const onLoad = async (ruleId: string) => {
    if (!activeDeviceId) return;
    setActiveRule(ruleId);
  };
  
  // New flow
  const onNew = () => {
    setNodes([]);
    setEdges([]);
    setCurrentRuleId(null);
    setRuleName('Untitled Rule');
    setActiveRule(null);
  };
  
  // Delete flow
  const onDelete = async () => {
    if (!activeDeviceId || !currentRuleId) return;
    if (!confirm('Delete this rule?')) return;
    await deleteFlow(activeDeviceId, currentRuleId);
    onNew();
  };
  
  // Run logs
  const runLogs = currentRuleId ? runLogsByRule[currentRuleId] || [] : [];
  
  // Enable rule runner (listen to stream packets and evaluate)
  useRuleRunner(activeDeviceId || undefined);
  
  // Listen to rule:run SSE for this rule (if active)
  const { data: ruleRunEvents } = useUdcpStream({
    channel: 'rule:run',
    deviceId: activeDeviceId || undefined,
    ruleId: currentRuleId || undefined,
    bufferSize: 100
  });
  
  useEffect(() => {
    if (ruleRunEvents && ruleRunEvents.length > 0) {
      const latest = ruleRunEvents[0] as any;
      // Append to store
      useRuleStore.getState().appendRunLog(latest);
    }
  }, [ruleRunEvents]);
  
  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center gap-3">
        <h2 className="text-xl font-bold">⚙️ Rule Engine (Node-RED style)</h2>
        
        <div className="flex items-center gap-2">
          <input 
            className="bg-gray-900 p-2 rounded text-sm"
            placeholder="Rule name"
            value={ruleName}
            onChange={e => setRuleName(e.target.value)}
          />
          <select 
            className="bg-gray-900 p-2 rounded text-sm"
            onChange={e => e.target.value && onLoad(e.target.value)}
            value={currentRuleId || ''}
          >
            <option value="">-- Load existing rule --</option>
            {(flowsByDevice[activeDeviceId || ''] || []).map(f => (
              <option key={f.rule_id} value={f.rule_id}>
                {f.name} (v{f.version}) • {new Date(f.updated_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2 ml-auto">
          <button className="btn btn-outline text-sm" onClick={onNew}>🆕 New</button>
          <button className="btn btn-primary text-sm" onClick={onSave}>💾 Save</button>
          <button className="btn btn-outline text-sm" onClick={onDelete} disabled={!currentRuleId}>🗑️ Delete</button>
        </div>
      </div>
      
      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="bg-yellow-900/50 border-l-4 border-yellow-500 text-yellow-200 p-2 px-4 text-sm">
          <div className="font-bold">⚠️ Validation Warnings:</div>
          <ul className="list-disc ml-6">
            {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
      
      {/* Main layout: ReactFlow + Palette + Logs */}
      <div className="flex-1 flex">
        {/* ReactFlow canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            snapToGrid
            snapGrid={[16, 16]}
            className="bg-gray-900"
          >
            <Background color="#374151" gap={16} />
            <Controls />
            <MiniMap 
              nodeColor={(n: any) => 
                n.type === 'sensor' ? '#2563eb' :
                n.type === 'condition' ? '#d97706' :
                n.type === 'action' ? '#16a34a' :
                '#7c3aed'
              }
              maskColor="rgba(0,0,0,0.6)"
            />
          </ReactFlow>
          
          {/* Floating info */}
          <div className="absolute top-2 left-2 bg-gray-800/90 border border-gray-700 rounded p-2 text-xs">
            <div><span className="text-gray-400">Device:</span> <span className="font-mono text-cyan-400">{activeDeviceId || '—'}</span></div>
            <div><span className="text-gray-400">Rule:</span> <span className="font-mono">{currentRuleId ? currentRuleId.slice(0,8)+'...' : '—'}</span></div>
            <div><span className="text-gray-400">Nodes:</span> {nodes.length} | <span className="text-gray-400">Edges:</span> {edges.length}</div>
          </div>
        </div>
        
        {/* Node Palette */}
        <div className="w-72 bg-gray-800 border-l border-gray-700 p-3 flex flex-col">
          <h3 className="text-lg font-bold mb-3">🧩 Node Palette</h3>
          
          <div className="space-y-2">
            <div 
              className="bg-blue-700 hover:bg-blue-600 cursor-grab p-2 rounded border border-blue-400"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow', 'sensor');
                e.dataTransfer.effectAllowed = 'move';
              }}
            >
              <div className="font-bold text-sm">🧠 Sensor</div>
              <div className="text-xs text-gray-200">Read stream value (motion/imu/light/...)</div>
            </div>
            
            <div 
              className="bg-amber-700 hover:bg-amber-600 cursor-grab p-2 rounded border border-amber-400"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow', 'condition');
                e.dataTransfer.effectAllowed = 'move';
              }}
            >
              <div className="font-bold text-sm">🔍 Condition</div>
              <div className="text-xs text-gray-200">IF {`>`} value</div>
            </div>
            
            <div 
              className="bg-purple-700 hover:bg-purple-600 cursor-grab p-2 rounded border border-purple-400"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow', 'transform');
                e.dataTransfer.effectAllowed = 'move';
              }}
            >
              <div className="font-bold text-sm">🔧 Transform</div>
              <div className="text-xs text-gray-200">scale/offset/map/avg</div>
            </div>
            
            <div 
              className="bg-green-700 hover:bg-green-600 cursor-grab p-2 rounded border border-green-400"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow', 'action');
                e.dataTransfer.effectAllowed = 'move';
              }}
            >
              <div className="font-bold text-sm">⚡ Action</div>
              <div className="text-xs text-gray-200">Send command to device</div>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-400">
            💡 <strong>Tip:</strong> Drag a node onto the canvas, then connect handles (left/right).
          </div>
          
          {/* Examples */}
          <div className="mt-4 border-t border-gray-700 pt-3">
            <h4 className="text-sm font-bold mb-2">📚 Examples</h4>
            <div className="space-y-2 text-xs">
              <button 
                className="w-full text-left bg-gray-900 hover:bg-gray-700 p-2 rounded"
                onClick={() => {
                  // Load example: Fall Detection
                  if (!activeDeviceId) return alert('Select a device first');
                  setRuleName('Fall Detection (motion-imu.ax > 3.0)');
                  setNodes([
                    {
                      id: 's1', type: 'sensor', position: { x: 50, y: 120 },
                      data: { label: 'IMU Sensor', streamId: 'motion-imu', field: 'ax', onChange: (p:any)=>updateNodeData('s1',p) }
                    },
                    {
                      id: 'c1', type: 'condition', position: { x: 300, y: 120 },
                      data: { label: 'IF > 3.0', operator: '>', value: 3.0, inputLabel: 'ax', onChange: (p:any)=>updateNodeData('c1',p) }
                    },
                    {
                      id: 'a1', type: 'action', position: { x: 550, y: 120 },
                      data: { label: 'Send Alert', command: 'alert', payload: { type: 'fall', severity: 'high' }, onChange: (p:any)=>updateNodeData('a1',p) }
                    }
                  ]);
                  setEdges([
                    { id: 'e1', source: 's1', target: 'c1' },
                    { id: 'e2', source: 'c1', target: 'a1' }
                  ]);
                  setCurrentRuleId(null);
                  setActiveRule(null);
                }}
              >
                🧯 <strong>Fall Detection</strong><br/>
                motion-imu.ax &gt; 3.0 → alert {`{type:"fall"}`}
              </button>
              
              <button 
                className="w-full text-left bg-gray-900 hover:bg-gray-700 p-2 rounded"
                onClick={() => {
                  if (!activeDeviceId) return alert('Select a device first');
                  setRuleName('Auto Light Control (light < 20 → LED ON)');
                  setNodes([
                    {
                      id: 's2', type: 'sensor', position: { x: 50, y: 180 },
                      data: { label: 'Light Sensor', streamId: 'light', field: 'lux', onChange: (p:any)=>updateNodeData('s2',p) }
                    },
                    {
                      id: 'c2', type: 'condition', position: { x: 300, y: 180 },
                      data: { label: 'IF < 20', operator: '<', value: 20, inputLabel: 'lux', onChange: (p:any)=>updateNodeData('c2',p) }
                    },
                    {
                      id: 'a2', type: 'action', position: { x: 550, y: 180 },
                      data: { label: 'LED ON', command: 'led', payload: { state: true }, onChange: (p:any)=>updateNodeData('a2',p) }
                    }
                  ]);
                  setEdges([
                    { id: 'e3', source: 's2', target: 'c2' },
                    { id: 'e4', source: 'c2', target: 'a2' }
                  ]);
                  setCurrentRuleId(null);
                  setActiveRule(null);
                }}
              >
                💡 <strong>Auto Light</strong><br/>
                light.lux &lt; 20 → LED ON
              </button>
            </div>
          </div>
          
          {/* Run Logs */}
          <div className="mt-4 flex-1 flex flex-col border-t border-gray-700 pt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold">📜 Run Logs</h4>
              <button 
                className="text-xs btn btn-outline px-2 py-0.5"
                onClick={() => currentRuleId && activeDeviceId && loadRunLogs(activeDeviceId, currentRuleId)}
              >
                🔄 Refresh
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-black rounded p-2">
              {runLogs.length === 0 ? (
                <div className="text-gray-500 text-xs">No runs yet.</div>
              ) : (
                <div className="space-y-1">
                  {runLogs.slice(0, 50).map(log => (
                    <div key={log.id} className="text-xs font-mono">
                      <span className="text-gray-400">
                        {new Date(log.ts).toLocaleTimeString()}.{(log.ts % 1000).toString().padStart(3,'0')}
                      </span>{' '}
                      <span className={
                        log.result === 'ok' ? 'text-green-400' :
                        log.result === 'error' ? 'text-red-400' : 'text-yellow-400'
                      }>
                        [{log.result.toUpperCase()}]
                      </span>{' '}
                      <span className="text-cyan-300">{log.details?.actionNodeId || '-'}</span>{' '}
                      {log.details?.command && <span className="text-white">{log.details.command}</span>}
                      {log.trigger_packet_msg_id && (
                        <span className="text-gray-500"> (trigger: {log.trigger_packet_msg_id.slice(0,8)}...)</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
