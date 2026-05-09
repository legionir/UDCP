import { LineChart, Line, XAxis, YAxis } from 'recharts';

export default function TransportHealth() {

  const data = Array.from({length:20}).map((_,i)=>({
    t:i,
    udp:10 + Math.random()*5,
    ws:30 + Math.random()*10,
    http:80
  }));

  return (
    <div className="p-4">
      <LineChart width={600} height={300} data={data}>
        <XAxis dataKey="t"/>
        <YAxis/>
        <Line dataKey="udp" stroke="#10b981"/>
        <Line dataKey="ws" stroke="#3b82f6"/>
        <Line dataKey="http" stroke="#f59e0b"/>
      </LineChart>
    </div>
  );
}
