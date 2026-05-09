import React, { useMemo, useRef, useEffect, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box } from '@react-three/drei';
import { useStreamData, useStreamConfig, STREAM_CONFIGS } from '../../hooks/useStreamData';
import type { StreamConfig } from '../../types/udcp';

// (calculateOrientation همان تابع قبلی است)

export function StreamVisualizer({ 
  streamId, 
  deviceId, 
  replayTime 
}: { 
  streamId: string; 
  deviceId?: string;
  replayTime?: number; // برای highlight packet در زمان خاص
}) {
  const { data, latest, config: cfg } = useStreamData(streamId, { deviceId, maxPoints: 1000 });
  const config = useStreamConfig(streamId);
  
  const [viewMode, setViewMode] = useState<'chart' | '3d' | 'gauge'>(config.type === 'imu' ? '3d' : config.type === 'gauge' ? 'gauge' : 'chart');
  
  // اگر replayTime داده شده، نقطه‌ای که دقیقاً در آن timestamp است را برجسته کن
  const highlightedIndex = useMemo(() => {
    if (replayTime == null) return -1;
    const idx = data.findIndex(d => Math.abs(d.timestamp - replayTime) < 5); // ±5ms tolerance
    return idx;
  }, [data, replayTime]);
  
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
          {replayTime && (
            <span className="text-xs text-cyan-400 ml-2">
              ⏱️ {new Date(replayTime).toLocaleTimeString()}.{(replayTime % 1000).toString().padStart(3,'0')}
            </span>
          )}
        </div>
        <IMU3DView data={data} latest={latest} highlightedIndex={highlightedIndex} />
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
          {replayTime && (
            <span className="text-xs text-cyan-400">
              ⏱️ {new Date(replayTime).toLocaleTimeString()}.{(replayTime % 1000).toString().padStart(3,'0')}
            </span>
          )}
        </div>
        <MultiChannelChart 
          data={data} 
          channels={config.channels} 
          labels={config.labels} 
          colors={config.colors}
          highlightedIndex={highlightedIndex}
        />
      </div>
    );
  }
  
  // Gauge
  if (viewMode === 'gauge') {
    return (
      <div className="stream-visualizer">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-semibold">🎚️ Gauge: {streamId}</h3>
          <select value={viewMode} onChange={e => setViewMode(e.target.value as any)} className="bg-gray-800 text-sm p-1 rounded">
            <option value="gauge">Gauge</option>
            <option value="chart">Chart</option>
          </select>
          {replayTime && (
            <span className="text-xs text-cyan-400">
              ⏱️ {new Date(replayTime).toLocaleTimeString()}.{(replayTime % 1000).toString().padStart(3,'0')}
            </span>
          )}
        </div>
        <GaugeView value={latest} config={config} />
      </div>
    );
  }
  
  return <div className="text-gray-400">No data</div>;
}

// ──────────────────────────────────────────────────────────────
// 3D IMU VIEW (Three.js) + highlight
// ──────────────────────────────────────────────────────────────
function IMU3DView({ data, latest, highlightedIndex }: { data: any[]; latest: any; highlightedIndex: number }) {
  const orientation = useMemo(() => {
    if (!latest) return { roll: 0, pitch: 0, yaw: 0 };
    return calculateOrientation(latest.values || {});
  }, [latest]);
  
  return (
    <div className="w-full h-[400px] bg-black rounded-lg overflow-hidden relative">
      <Canvas camera={{ position: [3, 3, 3], fov: 60 }}>
        <OrbitControls enablePan enableZoom enableRotate />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-5, -5, -5]} intensity={0.3} />
        
        <mesh rotation={[orientation.pitch, orientation.yaw, orientation.roll]}>
          <boxGeometry args={[1.5, 0.3, 0.8]} />
          <meshStandardMaterial 
            color={highlightedIndex >= 0 ? '#22c55e' : '#3b82f6'} 
            metalness={0.3} 
            roughness={0.4} 
          />
        </mesh>
        
        {/* Axes helper */}
        <axesHelper args={[2]} />
      </Canvas>
      
      {highlightedIndex >= 0 && (
        <div className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
          🎯 Highlight: seq={data[highlightedIndex]?.seq} • {new Date(data[highlightedIndex]?.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// MULTI-CHANNEL CHART (uPlot) + highlight
// ──────────────────────────────────────────────────────────────
function MultiChannelChart({ data, channels, labels, colors, highlightedIndex }: {
  data: any[];
  channels: string[];
  labels?: Record<string,string>;
  colors?: string[];
  highlightedIndex: number;
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
    
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    
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
      axes: [ { space: 40 }, { space: 60, label: 'Value' } ],
      scales: { x: { time: true } },
      legend: { show: true, live: false },
      cursor: { drag: { x: true, y: false }, focus: { prox: 16 } },
      hooks: {
        ready: [(u) => {
          // Auto-fit
          if (chartData[0]?.length) {
            u.setScale('x', { min: chartData[0][0], max: chartData[0][chartData[0].length - 1] });
          }
        }]
      }
    };
    
    chartRef.current = new uPlot(opts, chartData, containerRef.current);
    
    // Highlight point if exists
    if (highlightedIndex >= 0) {
      // Draw vertical marker
      const u = chartRef.current;
      // Custom overlay marker
      const overlay = document.createElement('div');
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '2px';
      overlay.style.height = '100%';
      overlay.style.background = '#22c55e';
      overlay.style.pointerEvents = 'none';
      containerRef.current.style.position = 'relative';
      containerRef.current.appendChild(overlay);
      
      const updateMarker = () => {
        const xPx = u.valToPos(chartData[0][highlightedIndex], 'x');
        overlay.style.left = `${xPx}px`;
      };
      updateMarker();
      u.setData(chartData);
    }
    
    const onResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.setSize({ width: containerRef.current.clientWidth, height: 400 });
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
  }, [chartData, channels, labels, colors, highlightedIndex]);
  
  return (
    <div className="w-full relative" ref={containerRef}>
      {highlightedIndex >= 0 && (
        <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded z-10">
          🎯 Highlight: seq={data[highlightedIndex]?.seq} • {new Date(data[highlightedIndex]?.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

// (GaugeView همان قبلی است)
function GaugeView({ value, config }: { value: any; config: StreamConfig }) {
  const val = value?.values?.[config.channels[0]] ?? 0;
  const unit = config.unit || '';
  const pct = Math.max(0, Math.min(100, ((val + 1) / 2) * 100));
  
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
