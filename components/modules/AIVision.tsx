import { useEffect, useRef } from 'react';
import { useUdcpSender } from '../../hooks/useUdcpSender';

export default function AIVision() {

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const { sendStream } = useUdcpSender();

  useEffect(()=>{
    let running = true;

    const start = async ()=>{

      const stream = await navigator.mediaDevices.getUserMedia({video:true});
      videoRef.current.srcObject = stream;

      const loop = ()=>{
        if(!running) return;

        const ctx = canvasRef.current.getContext('2d');
        ctx.drawImage(videoRef.current,0,0,640,480);

        // fake detection
        const result = {
          objects:[
            {x:100,y:100,w:50,h:50,score:0.9}
          ]
        };

        draw(ctx,result);

        sendStream({
          type:'stream',
          name:'vision',
          value:result,
          transport:['ws']
        });

        requestAnimationFrame(loop);
      };

      loop();
    };

    start();

    return ()=>running=false;

  },[]);

  return (
    <div>
      <video ref={videoRef} autoPlay className="hidden"/>
      <canvas ref={canvasRef} width={640} height={480}/>
    </div>
  );
}

---

## draw helper

function draw(ctx,result){
  ctx.strokeStyle='lime';

  result.objects.forEach(o=>{
    ctx.strokeRect(o.x,o.y,o.w,o.h);
  });
}

