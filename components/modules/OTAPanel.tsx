import { useState } from 'react';
import { useDevices } from '../../hooks/useDevices';
import axios from 'axios';

export default function OTAPanel(){

  const [file,setFile]=useState<File|null>(null);
  const [strategy,setStrategy]=useState('staged');
  const devices = useDevices();

  const upload = async ()=>{
    const fd = new FormData();
    fd.append('firmware',file!);

    const res = await axios.post('/api/ota/upload',fd);
    return res.data.id;
  };

  const deploy = async (id,devs)=>{
    await axios.post('/api/ota/deploy',{
      firmwareId:id,
      deviceIds: devs.map(d=>d.id)
    });
  };

  const start = async ()=>{
    const id = await upload();

    if(strategy==='immediate'){
      await deploy(id,devices);
    }

    if(strategy==='canary'){
      await deploy(id,[devices[0]]);
    }

    if(strategy==='staged'){
      await deploy(id,devices.slice(0,1));
      setTimeout(()=>deploy(id,devices.slice(0,3)),3000);
      setTimeout(()=>deploy(id,devices),6000);
    }
  };

  return (
    <div className="p-4 bg-gray-900">

      <input type="file" onChange={e=>setFile(e.target.files?.[0]||null)}/>

      <select onChange={e=>setStrategy(e.target.value)}>
        <option value="immediate">Immediate</option>
        <option value="staged">Staged</option>
        <option value="canary">Canary</option>
      </select>

      <button onClick={start}>Start OTA</button>

    </div>
  );
}


# ✅ 2.3 OTA Status

export function DeviceUpdateStatus({ updates }) {

  return (
    <div>
      {updates.map(u=>(
        <div key={u.deviceId} className="flex gap-2">
          <span>{u.deviceId}</span>
          <div className="w-40 bg-gray-800">
            <div style={{width:`${u.progress}%`}} className="bg-green-500 h-2"/>
          </div>
          <span>{u.stage}</span>
        </div>
      ))}
    </div>
  );
}
