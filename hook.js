export function usePacketWorker(packets, filters) {
  const [data,setData] = useState([]);

  useEffect(()=>{
    const worker = new Worker(new URL('../workers/packetWorker.ts', import.meta.url));

    worker.postMessage({ packets, filters });

    worker.onmessage = (e)=>{
      setData(e.data);
    };

    return ()=>worker.terminate();
  },[packets,filters]);

  return data;
}
