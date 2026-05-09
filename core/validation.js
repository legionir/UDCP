export function validateMessage(msg) {
  const required = [
    'v','msgId','ts','type','name','seq',
    'streamId','value','qos','route','auth','meta'
  ];

  for (const k of required) {
    if (!(k in msg)) return { ok:false, error:`missing ${k}` };
  }

  if (![0,1,2].includes(msg.qos)) return { ok:false, error:'invalid qos' };
  if (!Array.isArray(msg.route)) return { ok:false, error:'route must be array' };

  return { ok:true };
}
