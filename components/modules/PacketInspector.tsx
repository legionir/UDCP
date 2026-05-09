import { useMemo, useState } from 'react';
import { useUdcpStream } from '../../hooks/useUdcpStream';
import { Packet } from '../../types/udcp';

export default function PacketInspector() {
  const packets = useUdcpStream<Packet>();
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<Packet | null>(null);

  const [filters, setFilters] = useState({
    deviceId: '',
    streamId: '',
    transport: '',
    type: ''
  });

  const filtered = useMemo(() => {
    return packets.filter(p => {
      if (filters.deviceId && !p.deviceId.includes(filters.deviceId)) return false;
      if (filters.streamId && !p.streamId.includes(filters.streamId)) return false;
      if (filters.transport && p.transport !== filters.transport) return false;
      if (filters.type && p.type !== filters.type) return false;
      return true;
    });
  }, [packets, filters]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)]);
    const url = URL.createObjectURL(blob);
    window.open(url);
  };

  return (
    <div className="p-4">
      {/* controls */}
      <div className="flex gap-2 mb-3">
        <input placeholder="device" onChange={e => setFilters(f => ({...f, deviceId:e.target.value}))} />
        <input placeholder="stream" onChange={e => setFilters(f => ({...f, streamId:e.target.value}))} />
        <select onChange={e => setFilters(f => ({...f, transport:e.target.value}))}>
          <option value="">ALL</option>
          <option value="udp">UDP</option>
          <option value="ws">WS</option>
          <option value="http">HTTP</option>
        </select>

        <button onClick={() => setPaused(!paused)}>
          {paused ? 'Resume' : 'Pause'}
        </button>

        <button onClick={exportJSON}>Export</button>
      </div>

      {/* list */}
      <div className="h-[600px] overflow-auto text-xs font-mono">
        {filtered.map((p, i) => (
          <div
            key={i}
            onClick={() => setSelected(p)}
            className="flex gap-3 p-1 hover:bg-gray-800 cursor-pointer"
          >
            <span className="text-gray-500">
              {new Date(p.timestamp).toLocaleTimeString()}
            </span>

            <span className="font-bold">{p.deviceId}</span>

            <span className={{
              udp:'text-green-400',
              ws:'text-blue-400',
              http:'text-orange-400'
            }[p.transport]}>
              {p.transport}
            </span>

            <span>{p.type}/{p.name}</span>
            <span>#{p.seq}</span>
            <span>{p.size}B</span>
          </div>
        ))}
      </div>

      {/* detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 p-10">
          <div className="bg-gray-900 p-4">
            <pre>{JSON.stringify(selected, null, 2)}</pre>
            <button onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
