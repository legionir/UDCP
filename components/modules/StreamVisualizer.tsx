import { useStreamData } from '../../hooks/useStreamData';
import { useStreamConfig } from '../../hooks/useStreamConfig';
import { useMemo } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

const COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#a855f7'];

export default function StreamVisualizer({ streamId }: { streamId: string }) {
  const { data, latest } = useStreamData(streamId);
  const config = useStreamConfig(streamId);

  if (!data.length) return <div>No data</div>;

  if (config.type === 'imu') {
    return <IMU3DView data={data} />;
  }

  if (config.channels.length > 1) {
    return <MultiChannelChart data={data} channels={config.channels} />;
  }

  return <Gauge value={latest?.values?.value || 0} />;
}

function MultiChannelChart({ data, channels }) {
  const ref = (el: any) => {
    if (!el) return;

    const timestamps = data.map(d => d.timestamp / 1000);
    const series = channels.map(ch => data.map(d => d.values[ch] || 0));

    const chart = new uPlot({
      width: 800,
      height: 300,
      series: [
        {},
        ...channels.map((ch,i)=>({
          label: ch,
          stroke: COLORS[i],
          width: 2
        }))
      ]
    }, [timestamps, ...series], el);

    return () => chart.destroy();
  };

  return <div ref={ref}></div>;
}

---

## ✅ IMU 3D View

function IMU3DView({ data }) {
  const latest = data[data.length - 1];

  const rot = useMemo(() => {
    if (!latest) return [0,0,0];

    return [
      latest.values.ay || 0,
      latest.values.az || 0,
      latest.values.ax || 0
    ];
  }, [latest]);

  return (
    <Canvas style={{height:300}}>
      <ambientLight />
      <mesh rotation={rot}>
        <boxGeometry />
        <meshStandardMaterial color="orange"/>
      </mesh>
      <OrbitControls />
    </Canvas>
  );
}

---

## ✅ Gauge

function Gauge({ value }: { value:number }) {
  return (
    <div className="text-center text-3xl font-mono">
      {value.toFixed(2)}
    </div>
  );
}

