import React, { useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useMetricsStore } from '../../stores/metricsStore';

export function TransportHealthVisualizer({ deviceId }: { deviceId: string }) {
  const { latestMetrics, metricsHistory, fetchLatest, fetchHistory } = useMetricsStore();
  
  useEffect(() => {
    fetchLatest(deviceId);
    fetchHistory(deviceId, '5m');
    const iv = setInterval(() => {
      fetchLatest(deviceId);
      fetchHistory(deviceId, '5m');
    }, 5000);
    return () => clearInterval(iv);
  }, [deviceId, fetchLatest, fetchHistory]);
  
  const latest = latestMetrics[deviceId] || {};
  const history = metricsHistory[deviceId] || [];
  
  // Prepare chart data (merge UDP/WS/HTTP by timestamp)
  const chartData = useMemo(() => {
    // Group by timestamp
    const map = new Map<number, any>();
    history.forEach(m => {
      if (!map.has(m.ts)) map.set(m.ts, { timestamp: m.ts });
      const row = map.get(m.ts)!;
      row[`${m.transport}.rtt`] = m.rtt_avg;
      row[`${m.transport}.loss`] = m.loss_rate * 100;
      row[`${m.transport}.score`] = m.score;
    });
    return Array.from(map.values()).sort((a,b) => a.timestamp - b.timestamp);
  }, [history]);
  
  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard 
          title="UDP Health"
          score={latest.udp?.score ?? 0}
          rtt={latest.udp?.rtt_avg?.toFixed(0) ?? '0'}
          loss={(latest.udp?.loss_rate ? latest.udp.loss_rate*100 : 0).toFixed(1)}
          color="green"
          alert={latest.udp?.score < 40 || (latest.udp?.loss_rate||0) > 0.15}
        />
        <MetricCard 
          title="WS Health"
          score={latest.ws?.score ?? 0}
          rtt={latest.ws?.rtt_avg?.toFixed(0) ?? '0'}
          loss={(latest.ws?.loss_rate ? latest.ws.loss_rate*100 : 0).toFixed(1)}
          color="blue"
          alert={latest.ws?.score < 40 || (latest.ws?.loss_rate||0) > 0.15}
        />
        <MetricCard 
          title="HTTP Health"
          score={latest.http?.score ?? 0}
          rtt={latest.http?.rtt_avg?.toFixed(0) ?? '0'}
          loss={(latest.http?.loss_rate ? latest.http.loss_rate*100 : 0).toFixed(1)}
          color="orange"
          alert={latest.http?.score < 40 || (latest.http?.loss_rate||0) > 0.15}
        />
      </div>
      
      {/* RTT Timeline */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">⏱️ RTT Timeline (last 5 minutes)</h3>
        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(v) => new Date(v).toLocaleTimeString()} 
                minTickGap={30}
              />
              <YAxis label={{ value: 'RTT (ms)', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                labelFormatter={(v) => new Date(v).toLocaleString()}
                formatter={(val: any, name: string) => [`${Number(val).toFixed(1)}${name.includes('loss') ? '%' : 'ms'}`, name]}
              />
              <Legend />
              <Line type="monotone" dataKey="udp.rtt" stroke="#10b981" name="UDP RTT" dot={false} />
              <Line type="monotone" dataKey="ws.rtt" stroke="#3b82f6" name="WS RTT" dot={false} />
              <Line type="monotone" dataKey="http.rtt" stroke="#f59e0b" name="HTTP RTT" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Loss Timeline */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">📉 Packet Loss % (last 5 minutes)</h3>
        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(v) => new Date(v).toLocaleTimeString()} 
                minTickGap={30}
              />
              <YAxis label={{ value: 'Loss %', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
              <Tooltip 
                labelFormatter={(v) => new Date(v).toLocaleString()}
                formatter={(val: any) => [`${Number(val).toFixed(2)}%`, 'Loss']}
              />
              <Legend />
              <Line type="monotone" dataKey="udp.loss" stroke="#10b981" name="UDP Loss %" dot={false} />
              <Line type="monotone" dataKey="ws.loss" stroke="#3b82f6" name="WS Loss %" dot={false} />
              <Line type="monotone" dataKey="http.loss" stroke="#f59e0b" name="HTTP Loss %" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Transport Switch Log */}
      <TransportSwitchLog deviceId={deviceId} />
    </div>
  );
}

function MetricCard({ title, score, rtt, loss, color, alert }: {
  title: string; score: number; rtt: string; loss: string; color: 'green'|'blue'|'orange'; alert?: boolean;
}) {
  const bg = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    orange: 'bg-orange-500'
  }[color];
  
  return (
    <div className={`card border-2 ${alert ? 'border-red-500' : 'border-transparent'}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-lg font-bold">{title}</h4>
        {alert && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded">DEGRADED</span>}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-16">Score</span>
          <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
            <div className={`h-full ${bg}`} style={{ width: `${score}%` }} />
          </div>
          <span className="font-mono w-12 text-right">{score}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">RTT</span>
          <span className="font-mono text-cyan-400">{rtt}ms</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Loss (60s)</span>
          <span className="font-mono text-red-400">{loss}%</span>
        </div>
      </div>
    </div>
  );
}

function TransportSwitchLog({ deviceId }: { deviceId: string }) {
  // In production, you can store transport_switch_events in DB and fetch here
  const [switches] = React.useState([
    {
      timestamp: Date.now() - 120000,
      from: 'udp',
      to: 'ws',
      reason: 'UDP loss 18% + high jitter (42ms) → switching to WS',
      metrics: { loss: 18.2, jitter: 42, score: 35 }
    },
    {
      timestamp: Date.now() - 300000,
      from: 'ws',
      to: 'udp',
      reason: 'WS RTT 210ms → switching back to UDP (stable < 20ms)',
      metrics: { loss: 2.1, jitter: 18, score: 78 }
    }
  ]);
  
  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">🔀 Transport Switch History</h3>
      <div className="space-y-2">
        {switches.map((sw, i) => (
          <div key={i} className="bg-gray-800 p-3 rounded flex items-start gap-3">
            <div className="text-gray-400 text-xs w-28">
              {new Date(sw.timestamp).toLocaleString()}
            </div>
            <div className="flex-1">
              <div className="font-mono text-sm">
                <span className="text-green-400">{sw.from.toUpperCase()}</span>
                <span className="text-gray-500 mx-2">→</span>
                <span className="text-blue-400">{sw.to.toUpperCase()}</span>
              </div>
              <div className="text-sm text-gray-300 mt-1">{sw.reason}</div>
              <div className="text-xs text-gray-400 mt-1 flex gap-4">
                <span>Loss: {sw.metrics.loss}%</span>
                <span>Jitter: {sw.metrics.jitter}ms</span>
                <span>Score: {sw.metrics.score}</span>
              </div>
            </div>
          </div>
        ))}
        {switches.length === 0 && (
          <div className="text-gray-500 text-sm">No transport switches recorded yet.</div>
        )}
      </div>
    </div>
  );
}

function useMemo<T>(factory: () => T, deps: any[]): T {
  const ref = React.useRef<{ deps: any[]; value: T } | null>(null);
  if (!ref.current || !deps.every((d, i) => Object.is(d, ref.current!.deps[i]))) {
    ref.current = { deps: [...deps], value: factory() };
  }
  return ref.current.value;
}