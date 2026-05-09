import { useDevices } from '../../hooks/useDevices';

export default function DeviceFleet() {
  const devices = useDevices();

  return (
    <div className="grid grid-cols-3 gap-4 p-4">
      {devices.map(d => (
        <div key={d.id} className="bg-gray-900 p-4 rounded border">
          <div className="flex justify-between">
            <div>
              <div className="font-bold">{d.name}</div>
              <div className="text-xs text-gray-400">{d.id}</div>
            </div>
            <div className={d.status === 'online' ? 'text-green-400' : 'text-red-400'}>
              {d.status}
            </div>
          </div>

          <div className="mt-3 text-xs">
            UDP {d.transport.udp.score}%
            <br/>
            WS {d.transport.ws.score}%
            <br/>
            Heap {(d.heap.free/1024).toFixed(1)}KB
          </div>
        </div>
      ))}
    </div>
  );
}
