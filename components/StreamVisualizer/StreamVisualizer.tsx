import React, { useMemo, useRef, useEffect, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box } from '@react-three/drei';
import { useStreamData, useStreamConfig, STREAM_CONFIGS } from '../../hooks/useStreamData';
import type { StreamConfig } from '../../types/udcp';

// Helper: quaternion from accelerometer + gyro (basic complementary filter)
function calculateOrientation(values: Record<string, number>) {
  const ax = values['ax'] ?? 0, ay = values['ay'] ?? 0, az = values['az'] ?? 9.81;
  const gx = values['gx'] ?? 0, gy = values['gy'] ?? 0, gz = values['gz'] ?? 0;
  
  // Simple complementary filter (roll/pitch/yaw in radians)
  let roll = Math.atan2(ay, az);
  let pitch = Math.atan2(-ax, Math.sqrt(ay*ay + az*az));
  
  // Integrate gyro (very basic)
  const dt = 0.02; // assuming ~50Hz
  roll += gx * dt;
  pitch += gy * dt;
  
  return {
    roll,
    pitch,
    yaw: gz * dt // crude yaw integration
  };
}

export function StreamVisualizer({ streamId, deviceId }: { streamId: string; deviceId?: string }) {
  const { data, latest, config: cfg } = useStreamData(streamId, { deviceId, maxPoints: 1000 });
  const config = useStreamConfig(streamId);
  
  const [viewMode, setViewMode] = useState<'chart' | '3d' | 'gauge'>(config.type === 'imu' ? '3d' : config.type === 'gauge' ? 'gauge' : 'chart');
  
  // IMU 3D View
  if (viewMode === '3d' && config.type === 'imu') {
    return (
      <div className="stream-visualizer">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-semibold">🧭 3D IMU: {streamId}</h3>
          <select value={viewMode} onChange={e => setViewMode(e.target.value as any)} className="bg-gray-800 text-sm p-1 rounded">
            <option value="3d">3D</option>
            <option value="chart">Chart</option>
          </select>
        </div>
        <IMU3DView data={data} latest={latest} />
        <div className="text-xs text-gray-400 mt-2">
          Roll: {(calculateOrientation(latest?.values || {}).roll * 180/Math.PI).toFixed(1)}° | 
          Pitch: {(calculateOrientation(latest?.values || {}).pitch * 180/Math.PI).toFixed(1)}° | 
          Yaw: {(calculateOrientation(latest?.values || {}).yaw * 180/Math.PI).toFixed(1)}°
        </div>
      </div>
    );
  }
  
  // Multi-channel chart (uPlot)
  if (viewMode === 'chart' && (config.channels.length > 1 || config.type === 'imu')) {
    return (
      <div className="stream-visualizer">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-semibold">📈 Stream: {streamId}</h3>
          <select value={viewMode} onChange={e => setViewMode(e.target.value as any)} className="bg-gray-800 text-sm p-1 rounded">
            <option value="chart">Chart</option>
            {config.type === 'imu' && <option value="3d">3D</option>}
            {config.type === 'gauge' && <option value="gauge">Gauge</option>}
          </select>
          <div className="text-xs text-gray-400 ml-auto">
            {data.length} points • latest seq={latest?.seq ?? '-'}
          </div>
        </div>
        <MultiChannelChart data={data} channels={config.channels} labels={config.labels} colors={config.colors} />
      </div>
    );
  }
  
  // Gauge for single value
  if (viewMode === 'gauge') {
    return (
      <div className="stream-visualizer">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-semibold">🎚️ Gauge: {streamId}</h3>
          <select value={viewMode} onChange={e => setViewMode(e.target.value as any)} className="bg-gray-800 text-sm p-1 rounded">
            <option value="gauge">Gauge</option>
            <option value="chart">Chart</option>
          </select>
        </div>
        <GaugeView value={latest} config={config} />
      </div>
    );
  }
  
  return <div className="text-gray-400">No data</div>;
}

// ──────────────────────────────────────────────────────────────
// 3D IMU VIEW (Three.js)
// ──────────────────────────────────────────────────────────────
function IMU3DView({ data, latest }: { data: any[]; latest: any }) {
  const orientation = useMemo(() => {
    if (!latest) return { roll: 0, pitch: 0, yaw: 0 };
    return calculateOrientation(latest.values || {});
  }, [latest]);
  
  return (
    <div className="w-full h-[400px] bg-black rounded-lg overflow-hidden">
      <Canvas camera={{ position: [3, 3, 3], fov: 60 }}>
        <OrbitControls enablePan enableZoom enableRotate />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-5, -5, -5]} intensity={0.3} />
        
        <mesh rotation={[orientation.pitch, orientation.yaw, orientation.roll]}>
          <boxGeometry args={[1.5, 0.3, 0.8]} />
          <meshStandardMaterial color="#3b82f6" metalness={0.3} roughness={0.4} />
        </mesh>
        
        {/* Axes helper */}
        <axesHelper args={[2]} />
      </Canvas>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// MULTI-CHANNEL CHART (uPlot)
// ──────────────────────────────────────────────────────────────
function MultiChannelChart({ data, channels, labels, colors }: {
  data: any[];
  channels: string[];
  labels?: Record<string,string>;
  colors?: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  
  const chartData = useMemo(() => {
    const timestamps = data.map(d => d.timestamp / 1000);
    const seriesData = channels.map(ch => data.map(d => d.values?.[ch] ?? null));
    return [timestamps, ...seriesData] as [number[], ...number[][]];
  }, [data, channels]);
  
  useEffect(() => {
    if (!containerRef.current || chartData.length === 0) return;
    
    // Destroy previous chart
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
    
    const opts: uPlot.Options = {
      width: containerRef.current.clientWidth || 800,
      height: 400,
      series: [
        { label: 'Time (s)' },
        ...channels.map((ch, i) => ({
          label: labels?.[ch] || ch,
          stroke: colors?.[i] || ['#ef4444','#22c55e','#3b82f6','#f59e0b','#a855f7','#14b8a6'][i % 6],
          width: 2,
          spanGaps: false
        }))
      ],
      axes: [
        { space: 40 },
        { space: 60, label: 'Value' }
      ],
      scales: {
        x: { time: true }
      },
      legend: {
        show: true,
        live: false
      },
      cursor: {
        drag: { x: true, y: false },
        focus: { prox: 16 }
      },
      hooks: {
        ready: [(u) => {
          // Auto-fit on ready
          u.setScale('x', { min: u.data[0][0], max: u.data[0][u.data[0].length - 1] });
        }]
      }
    };
    
    chartRef.current = new uPlot(opts, chartData, containerRef.current);
    
    const onResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.setSize({
          width: containerRef.current.clientWidth,
          height: 400
        });
      }
    };
    window.addEventListener('resize', onResize);
    
    return () => {
      window.removeEventListener('resize', onResize);
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [chartData, channels, labels, colors]);
  
  return <div ref={containerRef} className="w-full" />;
}

// ──────────────────────────────────────────────────────────────
// GAUGE VIEW (single value)
// ──────────────────────────────────────────────────────────────
function GaugeView({ value, config }: { value: any; config: StreamConfig }) {
  const val = value?.values?.[config.channels[0]] ?? 0;
  const unit = config.unit || '';
  
  // Simple SVG gauge
  const pct = Math.max(0, Math.min(100, ((val + 1) / 2) * 100)); // normalize if [-1,1]
  
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-900 rounded-lg">
      <svg width="220" height="140" viewBox="0 0 220 140">
        <path d="M 30 110 A 80 80 0 0 1 190 110" fill="none" stroke="#374151" strokeWidth="20" strokeLinecap="round"/>
        <path d="M 30 110 A 80 80 0 0 1 190 110" fill="none" stroke="#3b82f6" strokeWidth="20" strokeLinecap="round"
          strokeDasharray={`${pct*1.57}, 157`}/>
        <circle cx="110" cy="110" r="10" fill="#3b82f6" />
      </svg>
      <div className="mt-4 text-center">
        <div className="text-5xl font-bold text-blue-400">
          {typeof val === 'number' ? val.toFixed(3) : val} {unit}
        </div>
        <div className="text-sm text-gray-400 mt-1">
          {config.labels?.[config.channels[0]] || config.channels[0]}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          seq={value?.seq ?? '-'} • {value?.transport?.toUpperCase() ?? '-'}
        </div>
      </div>
    </div>
  );
}

export default StreamVisualizer;

