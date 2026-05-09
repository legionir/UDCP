ws.on('message', (data) => {

  if (Buffer.isBuffer(data)) {
    // binary frame
    const view = new DataView(data.buffer);

    const seq = view.getUint32(0);
    const ax = view.getFloat32(4);

    eventBus.publishPacket({
      type:'binary',
      seq,
      ax
    });

    return;
  }

  // JSON fallback
});

