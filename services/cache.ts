import { openDB } from 'idb';

export const dbPromise = openDB('udcp',1,{
  upgrade(db){
    db.createObjectStore('packets',{keyPath:'msgId'});
    db.createObjectStore('devices',{keyPath:'id'});
  }
});

export async function savePacket(p){
  const db = await dbPromise;
  await db.put('packets',p);
}

export async function loadPackets(){
  const db = await dbPromise;
  return db.getAll('packets');
}

---

✅ استفاده در PacketInspector:

useEffect(()=>{
  loadPackets().then(setPackets);
},[]);
