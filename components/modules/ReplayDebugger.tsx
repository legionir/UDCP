import { useEffect, useState } from 'react';
import axios from 'axios';
import StreamVisualizer from './StreamVisualizer';
import PacketInspector from './PacketInspector';

export default function ReplayDebugger() {

  const [session, setSession] = useState<any>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    axios.get('/api/replay').then(r => {
      setSession(r.data);
      setTime(r.data.startTime);
    });
  }, []);

  useEffect(() => {
    if (!playing) return;

    const i = setInterval(() => {
      setTime(t => t + 50 * speed);
    }, 50);

    return () => clearInterval(i);
  }, [playing, speed]);

  if (!session) return <div>loading...</div>;

  const packets = session.packets.filter(p => p.timestamp <= time);

  return (
    <div className="p-4 space-y-4">

      <div className="flex gap-2">
        <button onClick={()=>setPlaying(!playing)}>
          {playing ? 'Pause':'Play'}
        </button>

        <input
          type="range"
          min={session.startTime}
          max={session.endTime}
          value={time}
          onChange={e=>setTime(Number(e.target.value))}
        />

        <select onChange={e=>setSpeed(Number(e.target.value))}>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={5}>5x</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <PacketInspector />
        <StreamVisualizer streamId="motion-imu" />
      </div>

      <NetworkSimulator />
    </div>
  );
}

---

## ✅ Network Simulator

function NetworkSimulator() {
  const [latency,setLatency]=useState(0);
  const [loss,setLoss]=useState(0);
  const [jitter,setJitter]=useState(0);

  return (
    <div className="bg-gray-800 p-3">
      Latency {latency}
      <input type="range" min={0} max={300} onChange={e=>setLatency(+e.target.value)}/>

      Loss {loss}%
      <input type="range" min={0} max={50} onChange={e=>setLoss(+e.target.value)}/>

      Jitter {jitter}
      <input type="range" min={0} max={100} onChange={e=>setJitter(+e.target.value)}/>
    </div>
  );
}

---

# ✅ 5. Memory Monitor

---

## ✅ backend (fake metrics فعلاً)

app.get('/api/memory/:id', (req,res)=>{
  res.json({
    freeHeap: 180,
    minHeap: 140,
    fragmentation: 5,
    watchdogNearTrigger:false,
    history: Array.from({length:20}).map((_,i)=>({
      t:i,
      heap:150 + Math.random()*20
    }))
  });
});

