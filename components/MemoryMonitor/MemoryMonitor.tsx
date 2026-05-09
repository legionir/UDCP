import React, { useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useMemoryStore } from '../../stores/memoryStore';

export function MemoryMonitor({ deviceId }: { deviceId: string }) {
  const { latestByDevice, historyByDevice, fetchLatest, fetchHistory } = useMemoryStore();
  
  useEffect(() => {
    fetchLatest(deviceId);
    fetchHistory(deviceId, '5m');
    const iv = setInterval(() => {
      fetchLatest(deviceId);
      fetchHistory(deviceId, '5m');
    }, 5000);
    return () => clearInterval(iv);
  }, [deviceId, fetchLatest, fetchHistory]);
  
  const latest = latestByDevice[deviceId];
  const history = historyByDevice[deviceId] || [];
  
  const fragAlert = latest && latest.fragmentation_pct > 30;
  const minAlert = latest && latest.min_heap_kb < 50;
  const watchdogAlert = latest?.watchdog_near_trigger === 1;
  
  const chartData = history.map(m => ({
    ts: m.ts,
    free: m.free_heap_kb,
    min: m.min_heap_kb,
    frag: m.fragmentation_pct
  }));
  
  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard 
          title="Free Heap" 
          value={`${latest?.free_heap_kb?.toFixed(1) ?? '-'} KB`} 
          sub={`Largest block: ${latest?.largest_free_block_kb?.toFixed(1) ?? '-'} KB`}
        />
        <MetricCard 
          title="Min Heap" 
          value={`${latest?.min_heap_kb?.toFixed(1) ?? '-'} KB`} 
          alert={minAlert}
          sub="Minimum ever observed"
        />
        <MetricCard 
          title="Fragmentation" 
          value={`${latest?.fragmentation_pct?.toFixed(1) ?? '-'} %`} 
          alert={fragAlert}
          sub="Heap fragmentation"
        />
      </div>
      
      {/* Watchdog Alert */}
      {watchdogAlert && (
        <div className="bg-red-900/60 border border-red-700 text-red-200 p-4 rounded-lg flex items-center gap-3">
          <div className="text-2xl">⚠️</div>
          <div>
            <div className="font-bold text-lg">Watchdog Near Trigger!</div>
            <div className="text-sm">ESP32 reports <code className="bg-black/40 px-1 rounded">watchdog_near_trigger = true</code>. Check task scheduling / long ISR / blocking operations.</div>
          </div>
        </div>
      )}
      
      {/* Heap Timeline */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">📈 Heap Timeline (Free / Min)</h3>
        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis 
                dataKey="ts" 
                tickFormatter={(v) => new Date(v).toLocaleTimeString()} 
                minTickGap={30}
              />
              <YAxis label={{ value: 'KB', angle: -90, position: 'insideLeft' }} />
              <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} />
              <Legend />
              <Line type="monotone" dataKey="free" stroke="#3b82f6" name="Free Heap (KB)" dot={false} />
              <Line type="monotone" dataKey="min" stroke="#f59e0b" name="Min Heap (KB)" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Fragmentation Timeline */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">🧩 Fragmentation %</h3>
        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis 
                dataKey="ts" 
                tickFormatter={(v) => new Date(v).toLocaleTimeString()} 
                minTickGap={30}
              />
              <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
              <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} />
              <Legend />
              <Line type="monotone" dataKey="frag" stroke="#ef4444" name="Fragmentation %" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Tasks & Queues (JSON preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">📋 Tasks</h3>
          <div className="bg-black rounded p-3 max-h-64 overflow-auto">
            <pre className="text-xs font-mono text-green-300 whitespace-pre-wrap">
              {latest?.tasks ? JSON.stringify(latest.tasks, null, 2) : 'No task info reported'}
            </pre>
          </div>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">🧵 Queues / Buffers</h3>
          <div className="bg-black rounded p-3 max-h-64 overflow-auto">
            <pre className="text-xs font-mono text-green-300 whitespace-pre-wrap">
              {latest?.queues ? JSON.stringify(latest.queues, null, 2) : 'No queue info reported'}
            </pre>
          </div>
        </div>
      </div>
      
      {/* Alerts summary */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-2">🚨 Alerts Summary</h3>
        <ul className="text-sm space-y-1">
          <li className={minAlert ? 'text-red-400' : 'text-gray-400'}>
            • Min Heap < 50KB: {minAlert ? '⚠️ YES' : '✅ OK'}
          </li>
          <li className={fragAlert ? 'text-red-400' : 'text-gray-400'}>
            • Fragmentation > 30%: {fragAlert ? '⚠️ YES' : '✅ OK'}
          </li>
          <li className={watchdogAlert ? 'text-red-400' : 'text-gray-400'}>
            • Watchdog near trigger: {watchdogAlert ? '⚠️ YES' : '✅ OK'}
          </li>
        </ul>
      </div>
    </div>
  );
}

function MetricCard({ title, value, sub, alert }: { title: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className={`card border-2 ${alert ? 'border-red-500' : 'border-transparent'}`}>
      <div className="text-sm text-gray-400">{title}</div>
      <div className={`text-3xl font-bold ${alert ? 'text-red-400' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
