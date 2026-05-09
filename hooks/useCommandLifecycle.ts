import { useEffect } from 'react';
import { useUdcpStream } from './useUdcpStream';
import { useCommandStore } from '../stores/commandStore';

/**
 * Subscribe to SSE command:update and command:${deviceId}
 * and update local command history in real-time
 */
export function useCommandLifecycle(deviceId?: string) {
  const { updateCommandFromEvent } = useCommandStore();
  
  // SSE: command:update (all commands)
  const { data: allCmdEvents } = useUdcpStream({
    channel: 'command:update',
    bufferSize: 200
  });
  
  // SSE: command:${deviceId} (device-specific)
  const { data: deviceCmdEvents } = useUdcpStream({
    channel: 'command:update',
    deviceId,
    bufferSize: 200
  });
  
  useEffect(() => {
    const events = [...(allCmdEvents || []), ...(deviceCmdEvents || [])];
    if (events.length > 0) {
      const latest = events[0] as any;
      if (latest?.device_id) {
        updateCommandFromEvent(latest);
      }
    }
  }, [allCmdEvents, deviceCmdEvents, updateCommandFromEvent]);
}