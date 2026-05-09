import React, { useEffect, useState } from 'react';
import { useCommandStore } from '../../stores/commandStore';
import { useCommandLifecycle } from '../../hooks/useCommandLifecycle';
import type { CommandRecord } from '../../types/udcp';

export function CommandCenter({ deviceId }: { deviceId: string }) {
  const { historyByDevice, fetchHistory, sendCommand } = useCommandStore();
  const history = historyByDevice[deviceId] || [];
  
  const [command, setCommand] = useState('led');
  const [payload, setPayload] = useState('{"state": true}');
  const [preferredTransport, setPreferredTransport] = useState<string[]>(['ws', 'http']);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Subscribe to realtime command lifecycle
  useCommandLifecycle(deviceId);
  
  useEffect(() => {
    fetchHistory(deviceId);
  }, [deviceId, fetchHistory]);
  
  const onSend = async () => {
    setSending(true);
    setError(null);
    try {
      let parsed: any;
      try { parsed = JSON.parse(payload); } catch { throw new Error('Payload must be valid JSON'); }
      
      await sendCommand(deviceId, {
        command,
        payload: parsed,
        qos: 2,
        preferredTransport: preferredTransport as any
      });
      
      setPayload('{"state": true}'); // reset
    } catch (e: any) {
      setError(e.message || 'Failed to send command');
    } finally {
      setSending(false);
    }
  };
  
  const commandOptions = [
    { value: 'led', label: 'LED Control' },
    { value: 'restart', label: 'Restart' },
    { value: 'ota', label: 'Firmware Update' },
    { value: 'sync_time', label: 'Sync Time' },
    { value: 'change_qos', label: 'Change QoS' },
    { value: 'force_transport', label: 'Force Transport' },
    { value: 'alert', label: 'Send Alert' }
  ];
  
  return (
    <div className="space-y-6">
      {/* Command Form */}
      <div className="card">
        <h3 className="text-xl font-bold mb-4">🎮 Command Center</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Command</label>
            <select 
              className="w-full bg-gray-800 p-2 rounded"
              value={command}
              onChange={e => setCommand(e.target.value)}
            >
              {commandOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-400 mb-1">Payload (JSON)</label>
            <textarea 
              className="w-full bg-black text-green-300 font-mono p-3 rounded h-28"
              value={payload}
              onChange={e => setPayload(e.target.value)}
              spellCheck={false}
            />
          </div>
        </div>
        
        <div className="mt-3 flex items-center gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Preferred Transport (QoS=2)</label>
            <div className="flex gap-2">
              {(['udp','ws','http'] as const).map(t => (
                <label key={t} className="flex items-center gap-1 text-sm">
                  <input 
                    type="checkbox"
                    checked={preferredTransport.includes(t)}
                    onChange={e => {
                      setPreferredTransport(prev => {
                        if (e.target.checked) return [...prev, t];
                        return prev.filter(x => x !== t);
                      });
                    }}
                  />
                  <span className={
                    t==='udp'?'text-green-400':t==='ws'?'text-blue-400':'text-orange-400'
                  }>{t.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="ml-auto">
            <button 
              className="btn btn-primary px-6 py-2"
              onClick={onSend}
              disabled={sending}
            >
              {sending ? '⏳ Sending...' : '🚀 Send Command'}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mt-3 bg-red-900/50 border border-red-700 text-red-200 p-2 rounded text-sm">
            ❌ {error}
          </div>
        )}
        
        <div className="mt-2 text-xs text-gray-500">
          ℹ️ این کامند با <strong>QoS=2</strong> ارسال می‌شود (دقیقاً یک‌بار، با ACK/DEDUP در سرور).
        </div>
      </div>
      
      {/* Command History */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">📜 Command History</h3>
          <div className="text-sm text-gray-400">
            Device: <span className="font-mono text-cyan-400">{deviceId}</span>
          </div>
        </div>
        
        <div className="space-y-2">
          {history.length === 0 ? (
            <div className="text-gray-500 text-sm p-4 text-center">No commands yet.</div>
          ) : (
            history.map(cmd => (
              <CommandRow key={cmd.id} command={cmd} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CommandRow({ command }: { command: CommandRecord }) {
  const stages = [
    { key: 'sent', name: 'SENT', time: command.sent_at },
    { key: 'delivered', name: 'DELIVERED', time: command.delivered_at },
    { key: 'executed', name: 'EXECUTED', time: command.executed_at },
    { key: 'confirmed', name: 'CONFIRMED', time: command.confirmed_at }
  ] as const;
  
  const getStageClass = (stageTime?: number) => {
    if (stageTime) return 'bg-green-600 text-white';
    if (command.status === 'failed' && stageTime === undefined) return 'bg-red-600 text-white';
    return 'bg-gray-700 text-gray-300';
  };
  
  const getDelta = (t?: number) => {
    if (!t) return null;
    const ms = t - command.sent_at;
    return ms >= 0 ? `${ms}ms` : `-${Math.abs(ms)}ms`;
  };
  
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-mono text-lg font-bold">{command.command}</div>
          <span className={`status-badge ${
            command.status === 'confirmed' ? 'status-online' :
            command.status === 'failed' ? 'status-offline' :
            command.status === 'executed' ? 'status-degraded' : 'bg-gray-600'
          }`}>
            {command.status.toUpperCase()}
          </span>
        </div>
        <div className="text-xs text-gray-400">
          sent {new Date(command.sent_at).toLocaleTimeString()}.{(command.sent_at % 1000).toString().padStart(3,'0')}
        </div>
      </div>
      
      {/* Payload preview */}
      <div className="mt-2 bg-black rounded p-2 text-xs font-mono text-green-300 max-h-24 overflow-auto">
        {JSON.stringify(command.payload, null, 2)}
      </div>
      
      {/* Lifecycle stages */}
      <div className="mt-3 flex flex-wrap gap-2">
        {stages.map((stage, i) => (
          <div 
            key={stage.key}
            className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-2 ${getStageClass(stage.time)}`}
            title={stage.time ? new Date(stage.time).toLocaleString() : 'pending'}
          >
            <span>{stage.name}</span>
            {stage.time && (
              <span className="text-[10px] opacity-90">{getDelta(stage.time)}</span>
            )}
          </div>
        ))}
      </div>
      
      {/* Transport + RTT info */}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-400">
        {command.preferred_transport && (
          <div>🚚 Preferred: <span className="font-mono text-white">{command.preferred_transport.join('+')}</span></div>
        )}
        {command.delivered_transport && (
          <div>📦 Delivered via: <span className="font-mono text-green-400">{command.delivered_transport.toUpperCase()}</span> {command.delivery_rtt_ms ? `(${command.delivery_rtt_ms}ms)` : ''}</div>
        )}
        {command.executed_transport && (
          <div>⚡ Executed via: <span className="font-mono text-yellow-400">{command.executed_transport.toUpperCase()}</span> {command.execution_rtt_ms ? `(${command.execution_rtt_ms}ms)` : ''}</div>
        )}
        {command.confirmed_transport && (
          <div>✅ Confirmed via: <span className="font-mono text-blue-400">{command.confirmed_transport.toUpperCase()}</span> {command.confirmation_rtt_ms ? `(${command.confirmation_rtt_ms}ms)` : ''}</div>
        )}
        {command.error_code && (
          <div className="text-red-400">❌ Error: <span className="font-mono">{command.error_code}</span> - {command.error_message}</div>
        )}
      </div>
      
      {/* msgId */}
      <div className="mt-1 text-[11px] text-gray-500 font-mono">
        msgId: {command.msg_id || '-'}
      </div>
    </div>
  );
}

