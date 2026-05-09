import { useEffect, useState } from 'react';
import { getDevices } from '../services/api';
import { Device } from '../types/udcp';

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    const load = async () => {
      const d = await getDevices();
      setDevices(d);
    };

    load();
    const i = setInterval(load, 2000);

    return () => clearInterval(i);
  }, []);

  return devices;
}
