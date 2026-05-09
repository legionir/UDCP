import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/layout/Layout';
import { usePacketStore } from './stores/packetStore';
import { useDeviceStore } from './stores/deviceStore';
import { useUdcpStream } from './hooks/useUdcpStream';
import { StatusBadge } from './components/common/StatusBadge';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

function AppContent() {
  const { addPacket } = usePacketStore();
  const { updateDeviceStatus } = useDeviceStore();
  
  // Listen to realtime packets
  const { data: packetEvents } = useUdcpStream({
    channel: 'packets',
    bufferSize: 500
  });
  
  // Listen to device status
  const { data: statusEvents } = useUdcpStream({
    channel: 'device:status',
    bufferSize: 100
  });
  
  // Process incoming realtime events
  useEffect(() => {
    if (packetEvents && packetEvents.length > 0) {
      const latest = packetEvents[0];
      addPacket(latest);
    }
  }, [packetEvents, addPacket]);
  
  useEffect(() => {
    if (statusEvents && statusEvents.length > 0) {
      const latest = statusEvents[0];
      updateDeviceStatus(latest.deviceId, latest.status);
    }
  }, [statusEvents, updateDeviceStatus]);
  
  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome Card */}
        <div className="card">
          <h2 className="text-2xl font-bold mb-2">🎯 Welcome to UDCP v5 Dashboard</h2>
          <p className="text-gray-400">
            Real-time monitoring, debugging, and control for your embedded devices.
          </p>
          <div className="mt-4 flex gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Realtime Connected</span>
            </div>
            <div className="text-sm text-gray-400">
              SSE: /api/events | WS: ws://localhost:8080
            </div>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Online Devices" value="3" icon="🟢" />
          <StatCard title="Packets/sec" value="~142" icon="📦" />
          <StatCard title="Avg RTT (UDP)" value="12ms" icon="⏱️" />
          <StatCard title="Packet Loss" value="1.2%" icon="📉" />
        </div>
        
        {/* Placeholder for future modules */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">🚧 Next Steps</h3>
          <ul className="space-y-2 text-gray-300">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✅</span>
              <span>Backend split + SQLite + SSE Realtime Bus</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-blue-500">🔜</span>
              <span>Packet Inspector (Wireshark-like)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-blue-500">🔜</span>
              <span>Device Fleet Dashboard</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-blue-500">🔜</span>
              <span>Transport Health Visualizer</span>
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: string }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="text-3xl">{icon}</div>
        <div className="text-right">
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm text-gray-400">{title}</div>
        </div>
      </div>
    </div>
  );
}
