import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useReplayStore } from '../../stores/replayStore';
import { useDeviceStore } from '../../stores/deviceStore';
import { api, createReplaySession, getReplaySession } from '../../services/api';
import { PacketInspector } from '../PacketInspector/PacketInspector';
import StreamVisualizer from '../StreamVisualizer/StreamVisualizer';
import type { ReplaySession, ReplayPacket } from '../../types/udcp';

export function ReplayDebugger() {
  const {
    sessions, currentSession, currentTime, playbackSpeed, isPlaying, networkSim,
    loadSession, setCurrentTime, setPlaybackSpeed, setIsPlaying, setNetworkSim, resetPlayback, createSession, exportSession
  } = useReplayStore();
  
  const { devices, selectedDeviceId, fetchDevices } = useDeviceStore();
  
  const [sessionName, setSessionName] = useState('imu_test_001');
  const [timeRange, setTimeRange] = useState<{start:number,end:number}>({start:0,end:0});
  const [selectedStream, setSelectedStream] = useState<string>('motion-imu');
  
  // Load devices on mount
  useEffect(() => { fetchDevices(); }, [fetchDevices]);
  
  // Playback timer
  useEffect(() => {
    if (!isPlaying || !currentSession) return;
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const next = prev + (1000 / playbackSpeed);
        if (next >= currentSession.end_time) {
          setIsPlaying(false);
          return currentSession.end_time;
        }
        return next;
      });
    }, 50); // ~20fps control
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, currentSession, setCurrentTime, setIsPlaying]);
  
  // Filter packets visible in current time window (with network simulation)
  const visiblePackets = useMemo(() => {
    if (!currentSession?.packets) return [];
    let packets = currentSession.packets.filter(p => p.timestamp <= currentTime);
    
    // Apply network simulation: latency + loss + jitter
    const { latency, loss, jitter } = networkSim;
    packets = packets.map(p => ({ ...p }));
    
    // Packet loss
    packets = packets.filter(() => Math.random() > (loss / 100));
    
    // Jitter: add random offset ±jitter/2
    packets = packets.map(p => ({
      ...p,
      timestamp: p.timestamp + (Math.random() * jitter - jitter/2)
    }));
    
    // Latency: delay packet
    packets = packets.map(p => ({
      ...p,
      timestamp: p.timestamp + latency
    }));
    
    return packets;
  }, [currentSession, currentTime, networkSim]);
  
  // Create new replay session
  const handleCreate = async () => {
    if (!selectedDeviceId) return alert('Select a device first');
    // Find time window of packets for device
    const packets = await api.getPackets({ deviceId: selectedDeviceId, limit: 10000 });
    if (!packets.length) return alert('No packets found for this device');
    const start = packets[packets.length - 1]?.received_at || Date.now() - 60000;
    const end = packets[0]?.received_at || Date.now();
    setTimeRange({ start, end });
    
    const session = await createSession({
      name: sessionName,
      deviceId: selectedDeviceId,
      startTime: start,
      endTime: end,
      metadata: { source: 'auto-window' }
    });
    await loadSession(session.id);
  };
  
  // Load existing session
  const handleLoad = async (id: string) => {
    await loadSession(id);
  };
  
  return (
    <div className="replay-debugger p-4 space-y-4">
      {/* Header + Controls */}
      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">⏪ Replay Debugger (Time Travel)</h2>
          <div className="text-sm text-gray-400">
            Session: {currentSession ? `${currentSession.name} (${currentSession.packet_count} packets)` : 'None'}
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Create session */}
          <div className="flex gap-2">
            <input
              className="flex-1 bg-gray-800 p-2 rounded text-sm"
              placeholder="Session name"
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
            />
            <button className="btn btn-primary text-sm" onClick={handleCreate}>
              Create
            </button>
          </div>
          
          {/* Load existing */}
          <select 
            className="bg-gray-800 p-2 rounded text-sm"
            onChange={e => e.target.value && handleLoad(e.target.value)}
          >
            <option value="">-- Load existing session --</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({new Date(s.created_at).toLocaleString()})
              </option>
            ))}
          </select>
          
          {/* Device select */}
          <select 
            className="bg-gray-800 p-2 rounded text-sm"
            value={selectedDeviceId || ''}
            onChange={e => useDeviceStore.getState().setSelectedDevice(e.target.value || null)}
          >
            <option value="">-- Select device --</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          
          {/* Export */}
          <button 
            className="btn btn-outline text-sm"
            disabled={!currentSession}
            onClick={() => currentSession && exportSession(currentSession.id)}
          >
            ⬇️ Export Session
          </button>
        </div>
      </div>
      
      {/* Playback controls */}
      <div className="card">
        <div className="flex items-center gap-4">
          <button 
            className="btn btn-primary"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          
          <div className="flex-1">
            <input
              type="range"
              min={currentSession?.start_time || 0}
              max={currentSession?.end_time || 0}
              value={currentTime}
              onChange={e => { setIsPlaying(false); setCurrentTime(Number(e.target.value)); }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{new Date(currentSession?.start_time || 0).toLocaleTimeString()}</span>
              <span className="font-mono">
                {new Date(currentTime).toLocaleTimeString()}.{(currentTime % 1000).toString().padStart(3,'0')}
              </span>
              <span>{new Date(currentSession?.end_time || 0).toLocaleTimeString()}</span>
            </div>
          </div>
          
          <select 
            className="bg-gray-800 p-2 rounded text-sm"
            value={playbackSpeed}
            onChange={e => setPlaybackSpeed(Number(e.target.value))}
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={5}>5x</option>
          </select>
          
          <button 
            className="btn btn-outline text-sm"
            onClick={() => resetPlayback()}
          >
            ⟲ Reset
          </button>
        </div>
      </div>
      
      {/* Network Simulator */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-3">🌐 Network Conditions Simulator</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <label className="block">
            <div className="flex justify-between mb-1">
              <span className="text-sm">Latency</span>
              <span className="font-mono text-cyan-400">{networkSim.latency}ms</span>
            </div>
            <input 
              type="range" min={0} max={500} step={5}
              value={networkSim.latency}
              onChange={e => setNetworkSim({ latency: Number(e.target.value) })}
              className="w-full"
            />
          </label>
          
          <label className="block">
            <div className="flex justify-between mb-1">
              <span className="text-sm">Packet Loss</span>
              <span className="font-mono text-red-400">{networkSim.loss}%</span>
            </div>
            <input 
              type="range" min={0} max={50} step={1}
              value={networkSim.loss}
              onChange={e => setNetworkSim({ loss: Number(e.target.value) })}
              className="w-full"
            />
          </label>
          
          <label className="block">
            <div className="flex justify-between mb-1">
              <span className="text-sm">Jitter</span>
              <span className="font-mono text-yellow-400">{networkSim.jitter}ms</span>
            </div>
            <input 
              type="range" min={0} max={100} step={5}
              value={networkSim.jitter}
              onChange={e => setNetworkSim({ jitter: Number(e.target.value) })}
              className="w-full"
            />
          </label>
        </div>
        <div className="mt-2 text-xs text-gray-400">
          ⚠️ این شبیه‌سازی روی <strong>replay packets</strong> اعمال می‌شود و روی شبکه واقعی دستگاه تأثیری ندارد.
        </div>
      </div>
      
      {/* Main view: Packet Inspector + Stream Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Packet Inspector (filtered by current time) */}
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">📦 Packet Inspector (Replay)</h3>
            <div className="flex items-center gap-2">
              <select 
                className="bg-gray-800 text-xs p-1 rounded"
                value={selectedStream}
                onChange={e => setSelectedStream(e.target.value)}
              >
                <option value="motion-imu">motion-imu</option>
                <option value="stick">stick</option>
                <option value="slider">slider</option>
              </select>
              <span className="text-xs text-gray-400">
                {visiblePackets.length} shown
              </span>
            </div>
          </div>
          <PacketInspector 
            packets={visiblePackets as any} 
            embedded={true} 
            showControls={false}
          />
        </div>
        
        {/* Right: Stream Visualizer */}
        <div className="card">
          <StreamVisualizer 
            streamId={selectedStream} 
            deviceId={currentSession?.device_id}
            replayTime={currentTime}
          />
        </div>
      </div>
      
      {/* Info panel */}
      <div className="card text-xs text-gray-400">
        <div className="flex flex-wrap gap-4">
          <div>🕒 Current: {new Date(currentTime).toLocaleString()}</div>
          <div>🎚️ Speed: {playbackSpeed}x</div>
          <div>📡 Sim: Latency {networkSim.latency}ms | Loss {networkSim.loss}% | Jitter {networkSim.jitter}ms</div>
          <div>📦 Visible packets: {visiblePackets.length}</div>
          {currentSession && (
            <div>📁 Session: {currentSession.name} (created {new Date(currentSession.created_at).toLocaleString()})</div>
          )}
        </div>
      </div>
    </div>
  );
}

