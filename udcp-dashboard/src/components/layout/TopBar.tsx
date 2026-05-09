import React from 'react';
import { useDeviceStore } from '../../stores/deviceStore';

export function TopBar() {
  const { selectedDeviceId, devices } = useDeviceStore();
  const selected = devices.find(d => d.id === selectedDeviceId);
  
  return (
    <header className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">
          {selected ? selected.name : 'No device selected'}
        </h2>
        {selected && (
          <div className="flex items-center gap-3 text-sm text-gray-300">
            <span>📍 {selected.metadata?.location || 'Unknown'}</span>
            <span>⏱️ {Math.floor((Date.now() - selected.last_seen) / 1000)}s ago</span>
            <span>🔧 {selected.firmware}</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-400">
          Last update: {new Date().toLocaleTimeString()}
        </div>
        <button className="btn btn-outline text-sm">
          🔄 Refresh
        </button>
      </div>
    </header>
  );
}
