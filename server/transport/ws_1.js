
try {
  if (msg.type === 'ack') {
    const ackFor = msg.value?.ackFor;
    if (ackFor) {
      // Look for command with this msg_id (we stored it when created)
      const cmd = db.prepare(`SELECT * FROM commands WHERE msg_id = ?`).get(ackFor);
      if (cmd) {
        const now = Date.now();
        const rtt = msg.value?.ackTs ? msg.value.ackTs - cmd.sent_at : null;
        
        if (msg.value?.status === 'executed') {
          db.prepare(`
            UPDATE commands SET 
              executed_at = ?, executed_transport = ?, executed_msg_id = ?, execution_rtt_ms = ?, status = COALESCE(status, 'delivered')
            WHERE id = ?
          `).run(now, 'ws', msg.msgId, rtt, cmd.id);
          
          const updated = db.prepare(`SELECT * FROM commands WHERE id = ?`).get(cmd.id);
          eventBusRef.publishCommandUpdate(updated);
        }
        
        if (msg.value?.status === 'confirmed') {
          db.prepare(`
            UPDATE commands SET 
              confirmed_at = ?, confirmed_transport = ?, confirmed_msg_id = ?, confirmation_rtt_ms = ?, status = 'confirmed'
            WHERE id = ?
          `).run(now, 'ws', msg.msgId, rtt, cmd.id);
          
          const updated = db.prepare(`SELECT * FROM commands WHERE id = ?`).get(cmd.id);
          eventBusRef.publishCommandUpdate(updated);
        }
      }
    }
  }
} catch (e) {
  console.error('[WS] Command ACK handling error:', e.message);
}
