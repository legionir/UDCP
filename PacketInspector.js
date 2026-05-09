import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export default function PacketList({ packets }) {

  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: packets.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10
  });

  return (
    <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(v => {
          const p = packets[v.index];

          return (
            <div
              key={v.key}
              style={{
                position: 'absolute',
                top: v.start,
                left: 0,
                width: '100%'
              }}
            >
              <PacketRow packet={p} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
