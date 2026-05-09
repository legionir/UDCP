import { useMemo } from 'react';
import { useUdcpStream } from './useUdcpStream';

export function useStreamData(streamId: string, opts = { maxPoints: 500 }) {
  const packets = useUdcpStream<any>();

  return useMemo(() => {
    const filtered = packets
      .filter(p => p.streamId === streamId)
      .slice(0, opts.maxPoints)
      .reverse();

    const data = filtered.map(p => ({
      timestamp: p.timestamp,
      values: p.payload || {}
    }));

    return {
      data,
      latest: data[data.length - 1]
    };
  }, [packets, streamId]);
}

