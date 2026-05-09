import React, { useMemo, useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { PacketRecord } from '../../types/udcp';

/**
 * Enhanced PacketInspector with:
 * - embedded mode (no fullscreen layout deps)
 * - showControls flag
 * - virtual scrolling
 * - expand payload modal
 * - export CSV/JSON
 * - pause/resume + search
 */
export function PacketInspector({
  packets: externalPackets,
  embedded = false,
  showControls = true
}: {
  packets?: PacketRecord[];
  embedded?: boolean;
  showControls?: boolean;
}) {
  // If externalPackets provided → controlled mode (e.g., Replay), else use store
  const { packets: storePackets, fetchPackets, setFilters: setStoreFilters, filters } = usePacketStore();
  const packets = externalPackets ?? storePackets;
  
  const [filtersLocal, setFiltersLocal] = useState({
    deviceId: '',
    streamId: '',
    transport: '',
    type: ''
  });
  const [search, setSearch] = useState('');
  const [paused, setPaused] = useState(false);
  const [selectedPacket, setSelectedPacket] = useState<PacketRecord | null>(null);
  
  // Use local filters if not embedded
  const activeFilters = embedded ? filters : filtersLocal;
  const setFilters = embedded ? setStoreFilters : setFiltersLocal;
  
  // SSE subscription (only if not controlled externally)
  useEffect(() => {
    if (embedded) return; // Replay controls its own data
    fetchPackets(activeFilters);
    const es = new EventSource(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/events?channel=packets`);
    es.addEventListener('packet', () => {
      if (!paused) fetchPackets(activeFilters);
    });
    return () => es.close();
  }, [activeFilters.deviceId, activeFilters.streamId, activeFilters.transport, activeFilters.type, paused, embedded, fetchPackets]);
  
  // Filter + search
  const filtered = useMemo(() => {
    let list = packets;
    
    // Apply filters
    if (activeFilters.deviceId) list = list.filter(p => p.device_id.includes(activeFilters.deviceId));
    if (activeFilters.streamId) list = list.filter(p => p.stream_id.includes(activeFilters.streamId));
    if (activeFilters.transport) list = list.filter(p => p.transport === activeFilters.transport);
    if (activeFilters.type) list = list.filter(p => p.type === activeFilters.type);
    
    // Apply search (device/stream/type/msgId/payload preview)
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => 
        p.device_id.toLowerCase().includes(q) ||
        p.stream_id.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.msg_id.toLowerCase().includes(q) ||
        JSON.stringify(p.payload).toLowerCase().includes(q)
      );
    }
    
    return list;
  }, [packets, activeFilters, search]);
  
  // Virtual scrolling
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 20
  });
  
  // Export CSV/JSON
  const exportData = async (format: 'csv' | 'json') => {
    const params = new URLSearchParams();
    if (activeFilters.deviceId) params.append('deviceId', activeFilters.deviceId);
    if (activeFilters.streamId) params.append('streamId', activeFilters.streamId);
    if (activeFilters.transport) params.append('transport', activeFilters.transport);
    if (activeFilters.type) params.append('type', activeFilters.type);
    params.append('format', format);
    
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/packets/export?${params.toString()}`;
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `packets_${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  
  return (
    <div className={`packet-inspector ${embedded ? '' : 'card'}`}>
      {/* Controls */}
      {showControls && !embedded && (
        <div className="p-3 border-b border-gray-700 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <input
              className="bg-gray-800 p-2 rounded text-sm"
              placeholder="Device ID contains..."
              value={activeFilters.deviceId}
              onChange={e => setFilters({ deviceId: e.target.value })}
            />
            <input
              className="bg-gray-800 p-2 rounded text-sm"
              placeholder="Stream ID contains..."
              value={activeFilters.streamId}
              onChange={e => setFilters({ streamId: e.target.value })}
            />
            <select 
              className="bg-gray-800 p-2 rounded text-sm"
              value={activeFilters.transport}
              onChange={e => setFilters({ transport: e.target.value as any })}
            >
              <option value="">All Transports</option>
              <option value="udp">UDP</option>
              <option value="ws">WS</option>
              <option value="http">HTTP</option>
            </select>
            <select 
              className="bg-gray-800 p-2 rounded text-sm"
              value={activeFilters.type}
              onChange={e => setFilters({ type: e.target.value })}
            >
              <option value="">All Types</option>
              <option value="stream">stream</option>
              <option value="event">event</option>
              <option value="command">command</option>
              <option value="state">state</option>
              <option value="ack">ack</option>
              <option value="error">error</option>
              <option value="hello">hello</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            <input
              className="bg-gray-800 p-2 rounded text-sm"
              placeholder="Search (device/stream/type/msgId/payload)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button 
              className="btn btn-outline text-sm"
              onClick={() => setPaused(p => !p)}
            >
              {paused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button className="btn btn-outline text-sm" onClick={() => exportData('csv')}>
              ⬇️ CSV
            </button>
            <button className="btn btn-outline text-sm" onClick={() => exportData('json')}>
              ⬇️ JSON
            </button>
          </div>
        </div>
      )}
      
      {/* Stats bar */}
      <div className="px-3 py-1 bg-gray-900 text-xs text-gray-400 flex justify-between border-b border-gray-800">
        <span>Total: {filtered.length}</span>
        <span>
          {activeFilters.deviceId && <>Device: <span className="text-cyan-400">{activeFilters.deviceId}</span> • </>}
          {activeFilters.streamId && <>Stream: <span className="text-cyan-400">{activeFilters.streamId}</span> • </>}
          {activeFilters.transport && <>Transport: <span className="text-cyan-400">{activeFilters.transport.toUpperCase()}</span> • </>}
          {activeFilters.type && <>Type: <span className="text-cyan-400">{activeFilters.type}</span> • </>}
          {paused && <span className="text-yellow-400">PAUSED</span>}
        </span>
      </div>
      
      {/* Packet list (virtualized) */}
      <div 
        ref={parentRef}
        className="packet-list"
        style={{ height: embedded ? '400px' : '600px', overflow: 'auto' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const packet = filtered[virtualRow.index];
            if (!packet) return null;
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <PacketRow packet={packet} onClick={() => setSelectedPacket(packet)} />
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Detail Modal */}
      {selectedPacket && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold font-mono">
                {selectedPacket.device_id} • {selectedPacket.transport.toUpperCase()} • {selectedPacket.type}/{selectedPacket.name}
              </h3>
              <button className="text-gray-400 hover:text-white" onClick={() => setSelectedPacket(null)}>✕</button>
            </div>
            
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-400">msgId:</span> <span className="font-mono">{selectedPacket.msg_id}</span></div>
              <div><span className="text-gray-400">seq:</span> <span className="font-mono">SEQ={selectedPacket.seq}</span></div>
              <div><span className="text-gray-400">streamId:</span> <span className="font-mono">{selectedPacket.stream_id}</span></div>
              <div><span className="text-gray-400">qos:</span> <span className="font-mono">QOS{selectedPacket.qos}</span></div>
              <div><span className="text-gray-400">size:</span> <span className="font-mono">{selectedPacket.size}B</span></div>
              <div><span className="text-gray-400">received_at:</span> <span className="font-mono">{new Date(selectedPacket.received_at).toLocaleString()}</span></div>
              <div><span className="text-gray-400">rtt_ms:</span> <span className="font-mono text-cyan-400">{selectedPacket.rtt_ms ?? '-'}</span></div>
              <div><span className="text-gray-400">status:</span> <span className={`status-badge ${
                selectedPacket.status === 'ok' ? 'bg-green-500' :
                selectedPacket.status === 'dropped' ? 'bg-red-500' :
                selectedPacket.status === 'reorder' ? 'bg-yellow-500' : 'bg-purple-500'
              }`}>{selectedPacket.status}</span></div>
            </div>
            
            <div className="px-4 pb-2 text-sm">
              <span className="text-gray-400">Payload (pretty JSON):</span>
            </div>
            
            <div className="flex-1 overflow-auto p-4 bg-black">
              <pre className="text-xs font-mono text-green-300 whitespace-pre-wrap">
                {JSON.stringify(selectedPacket.payload, null, 2)}
              </pre>
            </div>
            
            <div className="p-4 border-t border-gray-700 flex justify-end">
              <button className="btn btn-outline" onClick={() => setSelectedPacket(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PacketRow({ packet, onClick }: { packet: PacketRecord; onClick: () => void }) {
  const color = {
    udp: 'text-green-400',
    ws: 'text-blue-400',
    http: 'text-orange-400'
  }[packet.transport];
  
  const statusColor = {
    ok: 'bg-green-500',
    dropped: 'bg-red-500',
    reorder: 'bg-yellow-500',
    replay: 'bg-purple-500'
  }[packet.status];
  
  return (
    <div 
      className="packet-row font-mono text-sm hover:bg-gray-800 cursor-pointer px-3 flex items-center gap-3 border-b border-gray-800"
      onClick={onClick}
    >
      <span className="text-gray-500 w-28">
        {new Date(packet.received_at).toLocaleTimeString()}.{(packet.received_at % 1000).toString().padStart(3,'0')}
      </span>
      <span className="font-bold w-32 truncate">{packet.device_id}</span>
      <span className={`${color} w-14`}>{packet.transport.toUpperCase()}</span>
      <span className="w-40 truncate">{packet.type}/{packet.name}</span>
      <span className="w-20">SEQ={packet.seq}</span>
      {packet.rtt_ms && <span className="text-cyan-400 w-24">RTT={packet.rtt_ms}ms</span>}
      <span className="w-16">{packet.size}B</span>
      <span className={`status-badge ${statusColor} w-20 text-center`}>{packet.status}</span>
      <span className="text-gray-500 truncate flex-1 text-xs">{packet.msg_id}</span>
    </div>
  );
}

