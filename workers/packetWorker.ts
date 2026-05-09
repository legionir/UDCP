self.onmessage = (e) => {
  const { packets, filters } = e.data;

  const result = packets.filter(p => {
    if (filters.deviceId && !p.deviceId.includes(filters.deviceId)) return false;
    if (filters.transport && p.transport !== filters.transport) return false;
    return true;
  });

  self.postMessage(result);
};

