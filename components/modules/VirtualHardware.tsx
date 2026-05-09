import { useState } from 'react';
import { createModule } from '../../utils/createModule';
import { Module } from '../../types/module';

import VirtualJoystick from './vh/VirtualJoystick';
import VirtualSlider from './vh/VirtualSlider';
import VirtualButton from './vh/VirtualButton';
import VirtualColor from './vh/VirtualColor';

export default function VirtualHardware() {

  const [modules,setModules] = useState<Module[]>([]);

  return (
    <div className="p-4 grid grid-cols-2 gap-4">

      <ModulePalette onAdd={(type)=>{
        setModules(m=>[...m, createModule(type)]);
      }}/>

      <div className="grid grid-cols-2 gap-4">
        {modules.map(m=>(
          <ModuleRenderer key={m.id} module={m}/>
        ))}
      </div>

    </div>
  );
}

---

## ModuleRenderer

function ModuleRenderer({ module }) {

  switch(module.type){
    case 'joystick': return <VirtualJoystick module={module}/>;
    case 'slider': return <VirtualSlider module={module}/>;
    case 'button': return <VirtualButton module={module}/>;
    case 'color_picker': return <VirtualColor module={module}/>;
    default: return null;
  }
}

---

## ModulePalette

function ModulePalette({ onAdd }) {
  return (
    <div className="bg-gray-900 p-3">
      <div className="font-bold mb-2">Add Module</div>

      {['joystick','slider','button','color_picker'].map(t=>(
        <button
          key={t}
          onClick={()=>onAdd(t)}
          className="block w-full mb-2 bg-gray-800 p-2"
        >
          {t}
        </button>
      ))}
    </div>
  );
}

---

# ✅ 4. Virtual Modules

---

## ✅ Virtual Joystick

import { useState, useEffect } from 'react';
import { useUdcpSender } from '../../../hooks/useUdcpSender';

export default function VirtualJoystick({ module }) {

  const [pos,setPos] = useState({x:0,y:0});
  const { sendStream } = useUdcpSender();

  useEffect(()=>{
    if(!module.autoSend) return;

    const i = setInterval(()=>{
      sendStream({
        type:'stream',
        name:'stick',
        value:pos,
        transport:module.transport
      });
    },1000/module.rate);

    return ()=>clearInterval(i);
  },[pos,module]);

  return (
    <div className="bg-gray-900 p-3">

      <div>Joystick</div>

      <div
        className="w-40 h-40 bg-gray-700 relative"
        onMouseMove={(e)=>{
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left)/rect.width)*2-1;
          const y = ((e.clientY - rect.top)/rect.height)*2-1;
          setPos({x,y});
        }}
      />

      <div className="text-xs">
        X:{pos.x.toFixed(2)} Y:{pos.y.toFixed(2)}
      </div>

    </div>
  );
}

---

## ✅ Slider

export default function VirtualSlider({ module }) {
  const [v,setV]=useState(0);
  const { sendStream } = useUdcpSender();

  useEffect(()=>{
    const i = setInterval(()=>{
      sendStream({
        type:'stream',
        name:'slider',
        value:{value:v}
      });
    },1000/module.rate);

    return ()=>clearInterval(i);
  },[v]);

  return (
    <div className="bg-gray-900 p-3">
      <input type="range" onChange={e=>setV(+e.target.value)}/>
      {v}
    </div>
  );
}

---

## ✅ Button

export default function VirtualButton({ module }) {
  const { sendStream } = useUdcpSender();

  return (
    <button
      className="bg-blue-600 p-4"
      onClick={()=>sendStream({
        type:'event',
        name:'button',
        value:{pressed:true}
      })}
    >
      BUTTON
    </button>
  );
}

---

## ✅ Color Picker

export default function VirtualColor({ module }) {
  const { sendStream } = useUdcpSender();

  return (
    <input
      type="color"
      onChange={e=>{
        const c = e.target.value;
        sendStream({
          type:'state',
          name:'color',
          value:{color:c}
        });
      }}
    />
  );
}
