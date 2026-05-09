import PacketInspector from './components/modules/PacketInspector';
import DeviceFleet from './components/modules/DeviceFleet';
import StreamVisualizer from './components/modules/StreamVisualizer';
import ReplayDebugger from './components/modules/ReplayDebugger';
import MemoryMonitor from './components/modules/MemoryMonitor';

export default function App() {
  return (
    <div className="grid grid-cols-4 h-screen">

      <div className="bg-gray-950 p-3 space-y-2">
        <div>Devices</div>
        <div>Packets</div>
        <div>Streams</div>
        <div>Replay</div>
      </div>

      <div className="col-span-3 overflow-auto space-y-6">
        <DeviceFleet />
        <PacketInspector />
        <StreamVisualizer streamId="motion-imu"/>
        <ReplayDebugger />
        <MemoryMonitor deviceId="esp32-01"/>
      </div>

    </div>
  );
}
