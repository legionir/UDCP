app.post('/api/ota/deploy', (req,res)=>{

  const { firmwareId, deviceIds } = req.body;

  deviceIds.forEach(id=>{
    commandBus.send({
      deviceId:id,
      msg:{
        type:'command',
        name:'ota',
        value:{ firmwareId }
      }
    });
  });

  res.json({ ok:true });
});

