import React, { useEffect } from 'react';
import { useDeviceStore } from '../../stores/deviceStore';
import { useMemoryStore } from '../../stores/memoryStore';
import { useMetricsStore } from '../../stores/metricsStore';
import { StatusBadge } from '../common/StatusBadge';
import { TransportHealthVisualizer } from '../TransportHealth/TransportHealth';

export function DeviceFleet() {
  const { devices, selectedDeviceId, setSelectedDevice, fetchDevices } = useDeviceStore();
  const { fetchLatest: fetchLatestMemory } = useMemoryStore();
  const { fetchLatest: fetchLatestMetrics } = useMetricsStore();
  
  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 5000);
    return () => clearInterval(interval);
  }, [fetchDevices]);
  
  // Poll latest memory + metrics for all devices
  useEffect(() => {
    devices.forEach(d => {
      fetchLatestMemory(d.id);
      fetchLatestMetrics(d.id);
    });
  }, [devices, fetchLatestMemory, fetchLatestMetrics]);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">📡 Device Fleet</h2>
        <div className="text-sm text-gray-400">
          Total: {devices.length} • Online: {devices.filter(d=>d.status==='online').length}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map(device => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </div>
    </div>
  );
}

function DeviceCard({ device }: { device: Device }) {
  const { latestByDevice } = useMemoryStore();
  const { latestMetrics } = useMetricsStore();
  
  const mem = latestByDevice[device.id];
  const metrics = latestMetrics[device.id] || {};
  
  const statusColor = {
    online: 'border-green-500',
    offline: 'border-red-500',
    degraded: 'border-yellow-500'
  }[device.status];
  
  const udp = metrics.udp || { score: 0, rtt_avg: 0 };
  const ws  = metrics.ws  || { score: 0, rtt_avg: 0 };
  const http= metrics.http|| { score: 0, rtt_avg: 0 };
  
  const memFragAlert = mem && mem.fragmentation_pct > 30;
  const memMinAlert = mem && mem.min_heap_kb < 50;
  
  return (
    <div className={`device-card bg-gray-900 rounded-lg p-4 border-2 ${statusColor}`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-lg">{device.name}</h3>
          <p className="text-gray-400 text-sm font-mono">{device.id}</p>
        </div>
        <StatusBadge status={device.status} />
      </div>
      
      <div className="mt-4 space-y-2">
        {/* Transport Health Bars */}
        <div className="space-y-1">
          <HealthBar label="UDP" score={udp.score ?? 0} color="green" rtt={udp.rtt_avg?.toFixed(0)} />
          <HealthBar label="WS"  score={ws.score  ?? 0} color="blue"  rtt={ws.rtt_avg?.toFixed(0)} />
          <HealthBar label="HTTP" score={http.score?? 0} color="orange" rtt={http.rtt_avg?.toFixed(0)} />
        </div>
        
        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-400">RTT UDP</span>
            <span className="ml-2 font-mono">{(udp.rtt_avg ?? 0).toFixed(0)}ms</span>
          </div>
          <div>
            <span className="text-gray-400">RTT WS</span>
            <span className="ml-2 font-mono">{(ws.rtt_avg ?? 0).toFixed(0)}ms</span>
          </div>
          <div>
            <span className="text-gray-400">Loss (60s)</span>
            <span className="ml-2 font-mono">{((udp.loss_rate ?? 0)*100).toFixed(1)}%</span>
          </div>
          <div>
            <span className="text-gray-400">Jitter</span>
            <span className="ml-2 font-mono">{(udp.jitter ?? 0).toFixed(1)}ms</span>
          </div>
          <div>
            <span className="text-gray-400">Heap Free</span>
            <span className={`ml-2 font-mono ${memMinAlert ? 'text-red-400' : ''}`}>
              {mem ? `${mem.free_heap_kb.toFixed(1)}KB` : '-'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Frag</span>
            <span className={`ml-2 font-mono ${memFragAlert ? 'text-red-400' : ''}`}>
              {mem ? `${mem.fragmentation_pct.toFixed(1)}%` : '-'}
            </span>
          </div>
        </div>
        
        {/* Battery / RSSI */}
        <div className="flex items-center gap-3 text-sm">
          {device.metadata?.battery !== undefined && (
            <BatteryIndicator level={device.metadata.battery} />
          )}
          {device.metadata?.rssi !== undefined && (
            <div className="text-gray-400">📶 {device.metadata.rssi}dBm</div>
          )}
        </div>
        
        {/* Watchdog alert */}
        {mem?.watchdog_near_trigger ? (
          <div className="bg-red-900/40 border border-red-700 text-red-300 text-xs p-2 rounded">
            ⚠️ Watchdog near trigger!
          </div>
        ) : null}
      </div>
      
      <div className="mt-4 flex gap-2">
        <button 
          className="btn btn-outline text-sm"
          onClick={() => setSelectedDevice(device.id)}
        >
          Details
        </button>
        <button className="btn btn-outline text-sm">
          Console
        </button>
      </div>
    </div>
  );
}

function HealthBar({ label, score, color, rtt }: { label: string; score: number; color: string; rtt?: string }) {
  const bg = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    orange: 'bg-orange-500'
  }[color] || 'bg-gray-500';
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-12 text-gray-400">{label}</span>
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${bg} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs w-16 text-right font-mono">
        {score} {rtt ? `(${rtt}ms)` : ''}
      </span>
    </div>
  );
}

function BatteryIndicator({ level }: { level: number }) {
  const color = level > 60 ? 'bg-green-500' : level > 30 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-10 h-5 border border-gray-500 rounded-sm overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${level}%` }} />
      </div>
      <span className="text-xs text-gray-300">{level}%</span>
    </div>
  );
}