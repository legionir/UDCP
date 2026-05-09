import React, { useEffect, useRef, useState } from 'react';
import { useVirtualHardwareStore } from '../../stores/virtualHardwareStore';
import { useUdcpSender } from '../../hooks/useUdcpSender';
import { useDeviceStore } from '../../stores/deviceStore';
import type { ModuleType, VirtualModule } from '../../types/udcp';

export function VirtualHardware() {
  const { modules, addModule, removeModule, updateModule, moveModule, exportWorkspace, importWorkspace, clearWorkspace } = useVirtualHardwareStore();
  const { selectedDeviceId } = useDeviceStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  
  // Drag & drop helpers (simple)
  const onDropPalette = (e: React.DragEvent<HTMLDivElement>, type: ModuleType) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    addModule(type, { x, y });
  };
  
  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center gap-3">
        <h2 className="text-xl font-bold">🧩 Virtual Hardware Panel</h2>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Device:</span>
          <select 
            className="bg-gray-900 p-2 rounded text-sm"
            value={selectedDeviceId || ''}
            onChange={e => useDeviceStore.getState().setSelectedDevice(e.target.value || null)}
          >
            <option value="">-- Select device --</option>
            {/* devices list via store */}
          </select>
        </div>
        
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1">
            <input 
              className="bg-gray-900 p-2 rounded text-xs w-64"
              placeholder="Paste workspace JSON to import..."
              value={importText}
              onChange={e => setImportText(e.target.value)}
            />
            <button className="btn btn-outline text-xs" onClick={() => { importWorkspace(importText); setImportText(''); }}>
              Import
            </button>
          </div>
          <button className="btn btn-outline text-xs" onClick={() => {
            const json = exportWorkspace();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `udcp_workspace_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}>
            ⬇️ Export
          </button>
          <button className="btn btn-outline text-xs" onClick={() => { if(confirm('Clear workspace?')) clearWorkspace(); }}>
            🗑️ Clear
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex">
        {/* Module Palette */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 p-3">
          <h3 className="text-lg font-bold mb-3">🧰 Palette</h3>
          
          <div className="space-y-2">
            {([
              { type: 'joystick' as const, label: '🕹️ Joystick', desc: 'XY stick (UDP @ 120Hz)' },
              { type: 'slider' as const, label: '🎚️ Slider', desc: 'Single value (WS @ 60Hz)' },
              { type: 'button' as const, label: '🔘 Button', desc: 'Press/Release (WS @ 10Hz)' },
              { type: 'color_picker' as const, label: '🎨 Color Picker', desc: 'RGB (WS @ 30Hz)' },
              { type: 'piano' as const, label: '🎹 Piano', desc: 'MIDI notes (WS @ 60Hz)' }
            ] as const).map(item => (
              <div
                key={item.type}
                className="bg-gray-700 hover:bg-gray-600 cursor-grab p-3 rounded border border-gray-600"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/udcp-module', item.type);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onDragEnd={(e) => {
                  // on drop on workspace area
                }}
                onClick={() => addModule(item.type)}
              >
                <div className="font-bold text-sm">{item.label}</div>
                <div className="text-xs text-gray-300">{item.desc}</div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 text-xs text-gray-400">
            💡 <strong>Tip:</strong> Drag a module onto the workspace, or click to add at default position.<br/>
            ⚠️ برای UDP شما نیاز به سرور proxy یا ESP32 دارید (مرورگر مستقیم UDP ندارد).
          </div>
          
          <div className="mt-4 p-2 bg-gray-900 rounded text-xs">
            <div className="font-bold text-cyan-300">ℹ️ Connection</div>
            <div>Device: <span className="font-mono">{selectedDeviceId || '—'}</span></div>
            <div>Token: <span className="font-mono">{import.meta.env.VITE_UDCP_TOKEN || 'secret-token'}</span></div>
          </div>
        </div>
        
        {/* Workspace Area */}
        <div 
          className="flex-1 relative bg-gray-900 overflow-hidden"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData('application/udcp-module') as ModuleType;
            if (type) {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              addModule(type, { x, y });
            }
          }}
        >
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)',
            backgroundSize: '20px 20px'
          }} />
          
          {/* Render modules */}
          {modules.map(mod => (
            <ModuleRenderer 
              key={mod.id} 
              module={mod} 
              isSelected={selectedId === mod.id}
              onSelect={() => setSelectedId(mod.id)}
              onMove={(pos) => moveModule(mod.id, pos)}
              onRemove={() => removeModule(mod.id)}
              onUpdate={(patch) => updateModule(mod.id, patch)}
            />
          ))}
          
          {/* Empty state */}
          {modules.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-6xl mb-4">🧩</div>
                <div className="text-xl font-bold">Workspace خالی است</div>
                <div className="text-sm mt-2">یک ماژول را از پالت بکشید یا کلیک کنید تا اضافه شود</div>
                <div className="text-xs mt-4 text-gray-600">
                  Device: <span className="font-mono text-cyan-400">{selectedDeviceId || 'انتخاب نشده'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Inspector Panel */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 p-3 flex flex-col">
          <h3 className="text-lg font-bold mb-3">🔍 Inspector</h3>
          
          {selectedId ? (
            <ModuleInspector 
              module={modules.find(m => m.id === selectedId)!} 
              onUpdate={(patch) => updateModule(selectedId, patch)}
              onRemove={() => { removeModule(selectedId); setSelectedId(null); }}
            />
          ) : (
            <div className="text-gray-500 text-sm">
              یک ماژول را انتخاب کنید تا تنظیمات آن نمایش داده شود.
            </div>
          )}
          
          <div className="mt-auto p-2 bg-gray-900 rounded text-xs">
            <div className="font-bold text-cyan-300">📊 Workspace Stats</div>
            <div>Modules: <span className="font-mono">{modules.length}</span></div>
            <div>Auto-send active: <span className="font-mono">
              {modules.filter(m => m.config.autoSend).length}
            </span></div>
            <div>UDP modules: <span className="font-mono">
              {modules.filter(m => m.config.transport.includes('udp')).length}
            </span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// MODULE RENDERER (Draggable + Interactive)
// ──────────────────────────────────────────────────────────────

function ModuleRenderer({
  module,
  isSelected,
  onSelect,
  onMove,
  onRemove,
  onUpdate
}: {
  module: VirtualModule;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (pos: { x: number; y: number }) => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<VirtualModule>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  // Drag to move
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.module-controls')) return;
    onSelect();
    setDragging(true);
    const rect = ref.current!.getBoundingClientRect();
    setOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    e.preventDefault();
  };
  
  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e: MouseEvent) => {
      onMove({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };
    const onMouseUp = () => setDragging(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, offset, onMove]);
  
  // Render by type
  switch (module.type) {
    case 'joystick':
      return <VirtualJoystick module={module} isSelected={isSelected} onSelect={onSelect} onRemove={onRemove} onUpdate={onUpdate} dragRef={ref} onMouseDown={onMouseDown} />;
    case 'slider':
      return <VirtualSlider module={module} isSelected={isSelected} onSelect={onSelect} onRemove={onRemove} onUpdate={onUpdate} dragRef={ref} onMouseDown={onMouseDown} />;
    case 'button':
      return <VirtualButton module={module} isSelected={isSelected} onSelect={onSelect} onRemove={onRemove} onUpdate={onUpdate} dragRef={ref} onMouseDown={onMouseDown} />;
    case 'color_picker':
      return <VirtualColorPicker module={module} isSelected={isSelected} onSelect={onSelect} onRemove={onRemove} onUpdate={onUpdate} dragRef={ref} onMouseDown={onMouseDown} />;
    case 'piano':
      return <VirtualPiano module={module} isSelected={isSelected} onSelect={onSelect} onRemove={onRemove} onUpdate={onUpdate} dragRef={ref} onMouseDown={onMouseDown} />;
    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────────
// INDIVIDUAL MODULE COMPONENTS
// ──────────────────────────────────────────────────────────────

function VirtualJoystick({
  module, isSelected, onSelect, onRemove, onUpdate, dragRef, onMouseDown
}: any) {
  const { sendStream } = useUdcpSender();
  const [pos, setPos] = useState<{x:number,y:number}>(module.state?.x != null ? module.state : {x:0,y:0});
  const padRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<number | null>(null);
  
  // Auto-send loop
  useEffect(() => {
    if (!module.config.autoSend) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    const hz = module.config.rate || 120;
    intervalRef.current = window.setInterval(() => {
      sendStream({
        type: 'stream',
        name: module.config.streamName || 'stick',
        value: pos,
        qos: module.config.qos ?? 0,
        transport: module.config.transport || ['udp'],
        rate: hz
      });
    }, 1000 / hz);
    
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [module.config.autoSend, module.config.rate, module.config.transport, module.config.qos, module.config.streamName, pos, sendStream]);
  
  // Pointer interaction
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePosFromEvent(e);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if ((e.buttons & 1) === 1) updatePosFromEvent(e);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setPos({ x: 0, y: 0 });
    onUpdate({ state: { x: 0, y: 0 } });
  };
  
  const updatePosFromEvent = (e: React.PointerEvent) => {
    const rect = padRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const clampedX = Math.max(-1, Math.min(1, x));
    const clampedY = Math.max(-1, Math.min(1, y));
    setPos({ x: clampedX, y: clampedY });
    onUpdate({ state: { x: clampedX, y: clampedY } });
  };
  
  return (
    <div
      ref={dragRef}
      onMouseDown={onMouseDown}
      className={`absolute rounded-xl border-2 shadow-2xl cursor-move ${
        isSelected ? 'border-cyan-400 ring-2 ring-cyan-400/50' : 'border-gray-600'
      } bg-gray-800 p-3`}
      style={{ left: module.position.x, top: module.position.y, width: 220, zIndex: isSelected ? 50 : 10 }}
      onClick={onSelect}
    >
      {/* Controls */}
      <div className="module-controls absolute -top-2 -right-2 flex gap-1">
        <button className="w-5 h-5 bg-gray-700 hover:bg-red-600 rounded text-xs" onClick={onRemove} title="Remove">✕</button>
      </div>
      
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-sm">{module.name}</div>
        <div className="flex items-center gap-1">
          <span className="text-xs px-1 rounded bg-green-700 text-green-100">UDP</span>
          <span className="text-xs px-1 rounded bg-gray-700">{module.config.rate}Hz</span>
        </div>
      </div>
      
      {/* Joystick Pad */}
      <div
        ref={padRef}
        className="w-full h-36 bg-gray-900 rounded-lg relative border border-gray-700"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Center cross */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-px h-full bg-gray-700"></div>
          <div className="h-px w-full bg-gray-700"></div>
        </div>
        {/* Knob */}
        <div
          className="absolute w-12 h-12 rounded-full bg-cyan-500 shadow-lg border-2 border-white/80"
          style={{
            left: `calc(50% + ${(pos.x * 50).toFixed(1)}%)`,
            top: `calc(50% + ${(-pos.y * 50).toFixed(1)}%)`,
            transform: 'translate(-50%, -50%)'
          }}
        />
        <div className="absolute bottom-1 left-1 text-[10px] text-gray-400">-1</div>
        <div className="absolute top-1 right-1 text-[10px] text-gray-400">+1</div>
      </div>
      
      {/* Stats */}
      <div className="mt-2 flex justify-between text-xs font-mono">
        <span className="text-cyan-300">X: {pos.x.toFixed(2)}</span>
        <span className="text-cyan-300">Y: {pos.y.toFixed(2)}</span>
      </div>
      
      {/* Config row */}
      <div className="mt-2 flex items-center gap-2">
        <label className="text-xs text-gray-300">Auto</label>
        <input 
          type="checkbox" 
          checked={module.config.autoSend}
          onChange={e => onUpdate({ config: { ...module.config, autoSend: e.target.checked } })}
        />
        <select 
          className="bg-gray-900 text-xs p-1 rounded"
          value={module.config.rate}
          onChange={e => onUpdate({ config: { ...module.config, rate: Number(e.target.value) } })}
        >
          <option value={30}>30Hz</option>
          <option value={60}>60Hz</option>
          <option value={120}>120Hz</option>
        </select>
        <select 
          className="bg-gray-900 text-xs p-1 rounded"
          value={module.config.transport[0]}
          onChange={e => onUpdate({ config: { ...module.config, transport: [e.target.value as any] } })}
        >
          <option value="udp">UDP</option>
          <option value="ws">WS</option>
          <option value="http">HTTP</option>
        </select>
      </div>
      
      <div className="mt-1 text-[10px] text-gray-500">
        Stream: <span className="font-mono">{module.config.streamName}</span> • QoS{module.config.qos}
      </div>
    </div>
  );
}

function VirtualSlider({
  module, isSelected, onSelect, onRemove, onUpdate, dragRef, onMouseDown
}: any) {
  const { sendStream } = useUdcpSender();
  const [value, setValue] = useState<number>(module.state?.value ?? 0.5);
  const intervalRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!module.config.autoSend) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    const hz = module.config.rate || 60;
    intervalRef.current = window.setInterval(() => {
      sendStream({
        type: 'stream',
        name: module.config.streamName || 'slider',
        value: { value },
        qos: module.config.qos ?? 0,
        transport: module.config.transport || ['ws'],
        rate: hz
      });
    }, 1000 / hz);
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [module.config.autoSend, module.config.rate, module.config.transport, module.config.qos, module.config.streamName, value, sendStream]);
  
  const onChange = (v: number) => {
    const val = Math.max(0, Math.min(1, v));
    setValue(val);
    onUpdate({ state: { value: val } });
  };
  
  return (
    <div
      ref={dragRef}
      onMouseDown={onMouseDown}
      className={`absolute rounded-xl border-2 shadow-2xl cursor-move ${
        isSelected ? 'border-cyan-400 ring-2 ring-cyan-400/50' : 'border-gray-600'
      } bg-gray-800 p-3`}
      style={{ left: module.position.x, top: module.position.y, width: 220, zIndex: isSelected ? 50 : 10 }}
      onClick={onSelect}
    >
      <div className="module-controls absolute -top-2 -right-2 flex gap-1">
        <button className="w-5 h-5 bg-gray-700 hover:bg-red-600 rounded text-xs" onClick={onRemove} title="Remove">✕</button>
      </div>
      
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-sm">{module.name}</div>
        <div className="flex items-center gap-1">
          <span className="text-xs px-1 rounded bg-blue-700 text-blue-100">WS</span>
          <span className="text-xs px-1 rounded bg-gray-700">{module.config.rate}Hz</span>
        </div>
      </div>
      
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="mt-1 flex justify-between text-xs font-mono">
        <span>0</span>
        <span className="text-yellow-300">{value.toFixed(2)}</span>
        <span>1</span>
      </div>
      
      <div className="mt-2 flex items-center gap-2">
        <label className="text-xs text-gray-300">Auto</label>
        <input type="checkbox" checked={module.config.autoSend} onChange={e => onUpdate({ config: { ...module.config, autoSend: e.target.checked } })}/>
        <select className="bg-gray-900 text-xs p-1 rounded" value={module.config.rate} onChange={e=>onUpdate({config:{...module.config,rate:Number(e.target.value)}})}>
          <option value={30}>30Hz</option><option value={60}>60Hz</option><option value={120}>120Hz</option>
        </select>
      </div>
      <div className="text-[10px] text-gray-500">Stream: <span className="font-mono">{module.config.streamName}</span></div>
    </div>
  );
}

function VirtualButton({
  module, isSelected, onSelect, onRemove, onUpdate, dragRef, onMouseDown
}: any) {
  const { sendStream, sendEvent } = useUdcpSender();
  const [pressed, setPressed] = useState<boolean>(module.state?.pressed ?? false);
  const intervalRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!module.config.autoSend) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    const hz = module.config.rate || 10;
    intervalRef.current = window.setInterval(() => {
      // Send as stream (state snapshot)
      sendStream({
        type: 'stream',
        name: module.config.streamName || 'button',
        value: { pressed },
        qos: module.config.qos ?? 0,
        transport: module.config.transport || ['ws'],
        rate: hz
      });
    }, 1000 / hz);
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [module.config.autoSend, module.config.rate, module.config.transport, module.config.qos, module.config.streamName, pressed, sendStream]);
  
  const handlePress = async (down: boolean) => {
    setPressed(down);
    onUpdate({ state: { pressed: down } });
    
    // Send event for immediate action (optional)
    await sendEvent({
      type: 'event',
      name: module.config.streamName || 'button',
      value: { state: down ? 1 : 0, pressed: down },
      qos: 0,
      transport: ['ws', 'http']
    });
  };
  
  return (
    <div
      ref={dragRef}
      onMouseDown={onMouseDown}
      className={`absolute rounded-xl border-2 shadow-2xl cursor-move ${
        isSelected ? 'border-cyan-400 ring-2 ring-cyan-400/50' : 'border-gray-600'
      } bg-gray-800 p-3`}
      style={{ left: module.position.x, top: module.position.y, width: 180, zIndex: isSelected ? 50 : 10 }}
      onClick={onSelect}
    >
      <div className="module-controls absolute -top-2 -right-2 flex gap-1">
        <button className="w-5 h-5 bg-gray-700 hover:bg-red-600 rounded text-xs" onClick={onRemove} title="Remove">✕</button>
      </div>
      
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-sm">{module.name}</div>
        <div className="flex items-center gap-1">
          <span className="text-xs px-1 rounded bg-blue-700 text-blue-100">WS</span>
          <span className="text-xs px-1 rounded bg-gray-700">{module.config.rate}Hz</span>
        </div>
      </div>
      
      <button
        className={`w-full h-20 rounded-lg border-2 text-xl font-bold transition-all ${
          pressed ? 'bg-red-600 border-red-300 scale-95' : 'bg-gray-700 border-gray-400 hover:bg-gray-600'
        }`}
        onMouseDown={() => handlePress(true)}
        onMouseUp={() => handlePress(false)}
        onMouseLeave={() => pressed && handlePress(false)}
      >
        {pressed ? 'PRESSED' : 'PRESS'}
      </button>
      
      <div className="mt-2 flex items-center gap-2">
        <label className="text-xs text-gray-300">Auto</label>
        <input type="checkbox" checked={module.config.autoSend} onChange={e => onUpdate({ config: { ...module.config, autoSend: e.target.checked } })}/>
        <select className="bg-gray-900 text-xs p-1 rounded" value={module.config.rate} onChange={e=>onUpdate({config:{...module.config,rate:Number(e.target.value)}})}>
          <option value={5}>5Hz</option><option value={10}>10Hz</option><option value={30}>30Hz</option>
        </select>
      </div>
      <div className="text-[10px] text-gray-500">Stream: <span className="font-mono">{module.config.streamName}</span></div>
    </div>
  );
}

function VirtualColorPicker({
  module, isSelected, onSelect, onRemove, onUpdate, dragRef, onMouseDown
}: any) {
  const { sendStream } = useUdcpSender();
  const [color, setColor] = useState<{r:number,g:number,b:number}>(module.state?.r != null ? module.state : {r:255,g:165,b:0});
  const intervalRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!module.config.autoSend) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    const hz = module.config.rate || 30;
    intervalRef.current = window.setInterval(() => {
      sendStream({
        type: 'stream',
        name: module.config.streamName || 'color_picker',
        value: color,
        qos: module.config.qos ?? 0,
        transport: module.config.transport || ['ws'],
        rate: hz
      });
    }, 1000 / hz);
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [module.config.autoSend, module.config.rate, module.config.transport, module.config.qos, module.config.streamName, color, sendStream]);
  
  const onChange = (patch: Partial<{r:number,g:number,b:number}>) => {
    const next = { ...color, ...patch };
    setColor(next);
    onUpdate({ state: next });
  };
  
  return (
    <div
      ref={dragRef}
      onMouseDown={onMouseDown}
      className={`absolute rounded-xl border-2 shadow-2xl cursor-move ${
        isSelected ? 'border-cyan-400 ring-2 ring-cyan-400/50' : 'border-gray-600'
      } bg-gray-800 p-3`}
      style={{ left: module.position.x, top: module.position.y, width: 220, zIndex: isSelected ? 50 : 10 }}
      onClick={onSelect}
    >
      <div className="module-controls absolute -top-2 -right-2 flex gap-1">
        <button className="w-5 h-5 bg-gray-700 hover:bg-red-600 rounded text-xs" onClick={onRemove} title="Remove">✕</button>
      </div>
      
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-sm">{module.name}</div>
        <div className="flex items-center gap-1">
          <span className="text-xs px-1 rounded bg-blue-700 text-blue-100">WS</span>
          <span className="text-xs px-1 rounded bg-gray-700">{module.config.rate}Hz</span>
        </div>
      </div>
      
      <div className="w-full h-20 rounded-lg border border-gray-600" style={{ background: `rgb(${color.r},${color.g},${color.b})` }} />
      
      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs w-6 text-red-300">R</span>
          <input type="range" min={0} max={255} value={color.r} onChange={e=>onChange({r:Number(e.target.value)})} className="flex-1"/>
          <span className="text-xs w-10 font-mono">{color.r}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs w-6 text-green-300">G</span>
          <input type="range" min={0} max={255} value={color.g} onChange={e=>onChange({g:Number(e.target.value)})} className="flex-1"/>
          <span className="text-xs w-10 font-mono">{color.g}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs w-6 text-blue-300">B</span>
          <input type="range" min={0} max={255} value={color.b} onChange={e=>onChange({b:Number(e.target.value)})} className="flex-1"/>
          <span className="text-xs w-10 font-mono">{color.b}</span>
        </div>
      </div>
      
      <div className="mt-2 flex items-center gap-2">
        <label className="text-xs text-gray-300">Auto</label>
        <input type="checkbox" checked={module.config.autoSend} onChange={e => onUpdate({ config: { ...module.config, autoSend: e.target.checked } })}/>
        <select className="bg-gray-900 text-xs p-1 rounded" value={module.config.rate} onChange={e=>onUpdate({config:{...module.config,rate:Number(e.target.value)}})}>
          <option value={10}>10Hz</option><option value={30}>30Hz</option><option value={60}>60Hz</option>
        </select>
      </div>
      <div className="text-[10px] text-gray-500">Stream: <span className="font-mono">{module.config.streamName}</span></div>
    </div>
  );
}

function VirtualPiano({
  module, isSelected, onSelect, onRemove, onUpdate, dragRef, onMouseDown
}: any) {
  const { sendStream } = useUdcpSender();
  const [activeNote, setActiveNote] = useState<{note:string|null,velocity:number}>({note:null,velocity:0});
  const intervalRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!module.config.autoSend) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    const hz = module.config.rate || 60;
    intervalRef.current = window.setInterval(() => {
      sendStream({
        type: 'stream',
        name: module.config.streamName || 'midi',
        value: activeNote.note ? { note: activeNote.note, velocity: activeNote.velocity } : { note: null, velocity: 0 },
        qos: module.config.qos ?? 0,
        transport: module.config.transport || ['ws'],
        rate: hz
      });
    }, 1000 / hz);
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [module.config.autoSend, module.config.rate, module.config.transport, module.config.qos, module.config.streamName, activeNote, sendStream]);
  
  const notes = [
    { key: 'C4', label: 'C' }, { key: 'C#4', label: 'C#' }, { key: 'D4', label: 'D' }, { key: 'D#4', label: 'D#' },
    { key: 'E4', label: 'E' }, { key: 'F4', label: 'F' }, { key: 'F#4', label: 'F#' }, { key: 'G4', label: 'G' },
    { key: 'G#4', label: 'G#' }, { key: 'A4', label: 'A' }, { key: 'A#4', label: 'A#' }, { key: 'B4', label: 'B' }
  ];
  
  const playNote = (note: string, velocity: number) => {
    setActiveNote({ note, velocity });
    onUpdate({ state: { note, velocity } });
  };
  const releaseNote = () => {
    setActiveNote({ note: null, velocity: 0 });
    onUpdate({ state: { note: null, velocity: 0 } });
  };
  
  return (
    <div
      ref={dragRef}
      onMouseDown={onMouseDown}
      className={`absolute rounded-xl border-2 shadow-2xl cursor-move ${
        isSelected ? 'border-cyan-400 ring-2 ring-cyan-400/50' : 'border-gray-600'
      } bg-gray-800 p-3`}
      style={{ left: module.position.x, top: module.position.y, width: 420, zIndex: isSelected ? 50 : 10 }}
      onClick={onSelect}
    >
      <div className="module-controls absolute -top-2 -right-2 flex gap-1">
        <button className="w-5 h-5 bg-gray-700 hover:bg-red-600 rounded text-xs" onClick={onRemove} title="Remove">✕</button>
      </div>
      
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-sm">{module.name}</div>
        <div className="flex items-center gap-1">
          <span className="text-xs px-1 rounded bg-blue-700 text-blue-100">WS</span>
          <span className="text-xs px-1 rounded bg-gray-700">{module.config.rate}Hz</span>
        </div>
      </div>
      
      <div className="relative h-28 bg-black rounded border border-gray-700">
        {/* White keys */}
        <div className="absolute inset-0 flex">
          {notes.map((n, i) => (
            <div
              key={n.key}
              className={`flex-1 border-r border-gray-700 ${
                activeNote.note === n.key ? 'bg-yellow-300' : 'bg-white hover:bg-gray-200'
              }`}
              onMouseDown={() => playNote(n.key, 100)}
              onMouseUp={releaseNote}
              onMouseLeave={releaseNote}
            >
              <div className="text-[10px] text-gray-700 mt-16 text-center">{n.label}</div>
            </div>
          ))}
        </div>
        {/* Black keys */}
        <div className="absolute top-0 left-0 right-0 h-2/3 flex px-1">
          {['C#4','D#4','F#4','G#4','A#4'].map((nk, i) => (
            <div key={nk} className="w-[calc(100%/12)] px-0.5">
              <div
                className={`h-full w-full rounded-b ${
                  activeNote.note === nk ? 'bg-yellow-400' : 'bg-black hover:bg-gray-800'
                } border border-gray-700`}
                onMouseDown={() => playNote(nk, 100)}
                onMouseUp={releaseNote}
                onMouseLeave={releaseNote}
              />
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-2 text-xs text-gray-300">
        Active: <span className="font-mono text-yellow-300">{activeNote.note ?? '—'}</span> • Velocity: <span className="font-mono">{activeNote.velocity}</span>
      </div>
      
      <div className="mt-2 flex items-center gap-2">
        <label className="text-xs text-gray-300">Auto</label>
        <input type="checkbox" checked={module.config.autoSend} onChange={e => onUpdate({ config: { ...module.config, autoSend: e.target.checked } })}/>
        <select className="bg-gray-900 text-xs p-1 rounded" value={module.config.rate} onChange={e=>onUpdate({config:{...module.config,rate:Number(e.target.value)}})}>
          <option value={30}>30Hz</option><option value={60}>60Hz</option><option value={120}>120Hz</option>
        </select>
      </div>
      <div className="text-[10px] text-gray-500">Stream: <span className="font-mono">{module.config.streamName}</span></div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// INSPECTOR PANEL
// ──────────────────────────────────────────────────────────────

function ModuleInspector({
  module,
  onUpdate,
  onRemove
}: {
  module: VirtualModule;
  onUpdate: (patch: Partial<VirtualModule>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-bold text-lg">{module.name}</div>
        <button className="btn btn-outline text-xs" onClick={onRemove}>🗑️ Remove</button>
      </div>
      
      <div>
        <label className="text-xs text-gray-400 block">Module Name</label>
        <input 
          className="w-full bg-gray-900 p-2 rounded text-sm"
          value={module.name}
          onChange={e => onUpdate({ name: e.target.value })}
        />
      </div>
      
      <div>
        <label className="text-xs text-gray-400 block">Type</label>
        <div className="text-sm font-mono text-cyan-300">{module.type.toUpperCase()}</div>
      </div>
      
      <div className="border-t border-gray-700 pt-3">
        <div className="font-bold text-sm mb-2">⚙️ Streaming Config</div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-300">Auto Send</label>
            <input 
              type="checkbox"
              checked={module.config.autoSend}
              onChange={e => onUpdate({ config: { ...module.config, autoSend: e.target.checked } })}
            />
          </div>
          
          <div>
            <label className="text-xs text-gray-300 block">Rate (Hz)</label>
            <select 
              className="w-full bg-gray-900 p-1 rounded text-sm"
              value={module.config.rate}
              onChange={e => onUpdate({ config: { ...module.config, rate: Number(e.target.value) } })}
            >
              <option value={1}>1 Hz</option>
              <option value={5}>5 Hz</option>
              <option value={10}>10 Hz</option>
              <option value={30}>30 Hz</option>
              <option value={60}>60 Hz</option>
              <option value={120}>120 Hz</option>
            </select>
          </div>
          
          <div>
            <label className="text-xs text-gray-300 block">Stream Name</label>
            <input 
              className="w-full bg-gray-900 p-1 rounded text-sm font-mono"
              value={module.config.streamName}
              onChange={e => onUpdate({ config: { ...module.config, streamName: e.target.value } })}
            />
          </div>
          
          <div>
            <label className="text-xs text-gray-300 block">QoS</label>
            <select 
              className="w-full bg-gray-900 p-1 rounded text-sm"
              value={module.config.qos}
              onChange={e => onUpdate({ config: { ...module.config, qos: Number(e.target.value) as 0|1|2 } })}
            >
              <option value={0}>QoS0 (Fire/Forget)</option>
              <option value={1}>QoS1 (ACK)</option>
              <option value={2}>QoS2 (Exactly Once)</option>
            </select>
          </div>
          
          <div>
            <label className="text-xs text-gray-300 block">Transport</label>
            <div className="flex gap-2">
              {(['udp','ws','http'] as const).map(t => (
                <label key={t} className="flex items-center gap-1 text-xs">
                  <input 
                    type="checkbox"
                    checked={module.config.transport.includes(t)}
                    onChange={e => {
                      const next = e.target.checked
                        ? [...module.config.transport, t]
                        : module.config.transport.filter(x => x !== t);
                      onUpdate({ config: { ...module.config, transport: next } });
                    }}
                  />
                  <span className={
                    t==='udp'?'text-green-400':t==='ws'?'text-blue-400':'text-orange-400'
                  }>{t.toUpperCase()}</span>
                </label>
              ))}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              ⚠️ UDP نیاز به سرور proxy/ESP32 دارد (مرورگر مستقیم UDP ندارد).
            </div>
          </div>
        </div>
      </div>
      
      {/* Current State preview */}
      <div className="border-t border-gray-700 pt-3">
        <div className="font-bold text-sm mb-2">📊 Current State</div>
        <div className="bg-black rounded p-2 text-xs font-mono text-green-300 max-h-40 overflow-auto">
          {JSON.stringify(module.state || {}, null, 2)}
        </div>
      </div>
      
      <div className="border-t border-gray-700 pt-3 text-xs text-gray-400">
        <div>🆔 <span className="font-mono">{module.id.slice(0,8)}...</span></div>
        <div>📍 Pos: {Math.round(module.position.x)}, {Math.round(module.position.y)}</div>
      </div>
    </div>
  );
}

export default VirtualHardware;

