import { useEffect, useState } from 'react';

export function useUdcpStream<T>() {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    const es = new EventSource('/api/events');

    es.addEventListener('packet', (e) => {
      const p = JSON.parse(e.data);
      setData(prev => [p, ...prev].slice(0, 500));
    });

    return () => es.close();
  }, []);

  return data;
}