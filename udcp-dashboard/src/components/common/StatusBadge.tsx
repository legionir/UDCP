import React from 'react';

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'degraded';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    online: { label: 'ONLINE', className: 'status-online' },
    offline: { label: 'OFFLINE', className: 'status-offline' },
    degraded: { label: 'DEGRADED', className: 'status-degraded' }
  }[status];
  
  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
}
