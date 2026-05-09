import { useEffect, useState } from 'react';
import axios from 'axios';

export default function MemoryMonitor({ deviceId }) {

  const [m,setM] = useState<any>(null);

  useEffect(()=>{
    axios.get(`/api/memory/${deviceId}`).then(r=>setM(r.data));
  },[deviceId]);

  if(!m) return null;

  return (
    <div className="p-4 space-y-3">

      <div className="grid grid-cols-3 gap-2">
        <Metric title="Free" value={m.freeHeap}/>
        <Metric title="Min" value={m.minHeap} alert={m.minHeap<50}/>
        <Metric title="Frag" value={m.fragmentation} alert={m.fragmentation>30}/>
      </div>

      <div className="bg-gray-800 p-2">
        {m.history.map((h,i)=>(
          <div key={i}>{h.heap}</div>
        ))}
      </div>

      {m.watchdogNearTrigger && (
        <div className="text-red-500">⚠️ watchdog</div>
      )}

    </div>
  );
}

function Metric({title,value,alert}) {
  return (
    <div className={`p-2 ${alert?'bg-red-800':'bg-gray-800'}`}>
      {title}: {value}
    </div>
  );
}
