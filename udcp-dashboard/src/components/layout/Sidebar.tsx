import React from 'react';
import { useDeviceStore } from '../../stores/deviceStore';
import { StatusBadge } from '../common/StatusBadge';

export function Sidebar() {
  const { devices, selectedDeviceId, setSelectedDevice, fetchDevices } = useDeviceStore();
  
  React.useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, [fetchDevices]);
  
  return (
    <aside className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">🚀 UDCP v5</h1>
        <p className="text-xs text-gray-400">Admin Dashboard</p>
      </div>
      
      <div className="p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-2">Devices</h2>
        
        <div className="space-y-2">
          {devices.map(device => (
            <button
              key={device.id}
              onClick={() => setSelectedDevice(device.id)}
              className={`w-full text-left p-3 rounded-lg transition-all ${
                selectedDeviceId === device.id
                  ? 'bg-blue-600'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">{device.name}</div>
                  <div className="text-xs text-gray-300">{device.id}</div>
                </div>
                <StatusBadge status={device.status} />
              </div>
              
              <div className="mt-2 flex gap-2 text-xs text-gray-300">
                <span>📶 {device.metadata?.rssi ?? '-'}dBm</span>
                <span>🔋 {device.metadata?.battery ?? '-'}%</span>
              </div>
              
              <div className="mt-1 text-xs text-gray-400">
                FW: {device.firmware}
              </div>
            </button>
          ))}
        </div>
      </div>
      
      <div className="mt-auto p-4 border-t border-gray-700">
        <div className="text-xs text-gray-400">
          <div>API: {import.meta.env.VITE_API_URL || 'localhost:4000'}</div>
          <div>WS: {import.meta.env.VITE_WS_URL || 'localhost:8080'}</div>
        </div>
      </div>
    </aside>
  );
}