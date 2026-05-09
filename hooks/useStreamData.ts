import { useEffect, useMemo, useState } from 'react';
import { usePacketStore } from '../stores/packetStore';
import type { PacketRecord } from '../types/udcp';

/**
 * Fetch stream data (time-series values) for a given streamId
 * Filters packets of type='stream' and name matches stream context
 */
export function useStreamData(streamId: string, opts?: { maxPoints?: number; deviceId?: string }) {
  const { maxPoints = 1000, deviceId } = opts || {};
  const { packets, fetchPackets } = usePacketStore();
  const [config, setConfig] = useState<any>(null);
  
  // Fetch packets for this stream (realtime + initial load)
  useEffect(() => {
    fetchPackets({ streamId, deviceId, limit: 2000 });
    const es = new EventSource(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/events?channel=packets&streamId=${streamId}${deviceId ? `&deviceId=${deviceId}` : ''}`);
    es.addEventListener('packet', () => {
      fetchPackets({ streamId, deviceId, limit: 2000 });
    });
    return () => es.close();
  }, [streamId, deviceId, fetchPackets]);
  
  // Filter stream packets only
  const streamPackets = useMemo(() => {
    return packets
      .filter(p => p.stream_id === streamId && p.type === 'stream')
      .sort((a,b) => a.received_at - b.received_at)
      .slice(-maxPoints);
  }, [packets, streamId, maxPoints]);
  
  // Extract values map: { timestamp, values: { ax: 0.12, ay: -0.24, ... } }
  const data = useMemo(() => {
    return streamPackets.map(p => ({
      timestamp: p.received_at,
      values: p.payload || {},
      msgId: p.msg_id,
      seq: p.seq,
      transport: p.transport,
      rtt: p.rtt_ms
    }));
  }, [streamPackets]);
  
  // Latest snapshot
  const latest = useMemo(() => data[data.length - 1] || null, [data]);
  
  return { data, latest, packets: streamPackets, config };
}

/**
 * Stream config registry (imu/multi/gauge). In production you can load from API.
 */
export const STREAM_CONFIGS: Record<string, any> = {
  'motion-imu': {
    streamId: 'motion-imu',
    type: 'imu',
    channels: ['ax', 'ay', 'az', 'gx', 'gy', 'gz'],
    labels: { ax: 'Accel X', ay: 'Accel Y', az: 'Accel Z', gx: 'Gyro X', gy: 'Gyro Y', gz: 'Gyro Z' },
    colors: ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#14b8a6']
  },
  'stick': {
    streamId: 'stick',
    type: 'multi',
    channels: ['x', 'y'],
    labels: { x: 'Stick X', y: 'Stick Y' },
    colors: ['#3b82f6', '#f59e0b']
  },
  'slider': {
    streamId: 'slider',
    type: 'gauge',
    channels: ['value'],
    unit: '%'
  }
};

export function useStreamConfig(streamId: string) {
  return STREAM_CONFIGS[streamId] || {
    streamId,
    type: 'multi',
    channels: Object.keys(STREAM_CONFIGS[streamId]?.channels || ['value']),
    labels: {},
    colors: ['#3b82f6']
  };
}

