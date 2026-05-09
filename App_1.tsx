import PacketInspector from './components/modules/PacketInspector';
import DeviceFleet from './components/modules/DeviceFleet';
import TransportHealth from './components/modules/TransportHealth';

export default function App() {
  return (
    <div className="grid grid-cols-4 h-screen">
      
      <div className="col-span-1 bg-gray-950 p-3">
        <div>UDCP</div>
        <div>Devices</div>
        <div>Packets</div>
      </div>

      <div className="col-span-3 overflow-auto">
        <DeviceFleet />
        <TransportHealth />
        <PacketInspector />
      </div>

    </div>
  );
}