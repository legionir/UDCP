import { eventBus } from '../ui-gateway/events.js';

// Simple metrics collector
class MetricsCollector {
  constructor(db, bus) {
    this.db = db;
    this.bus = bus;
    this.ackMap = new Map(); // key: deviceId:transport -> {sendTs, packet}
  }
  
  recordAck(deviceId, transport, sendTs, recvTs) {
    const rtt = recvTs - sendTs;
    if (rtt < 0) return;
    
    // Update in-memory stats (simple EWMA + pXX)
    // For v5: store in transport_metrics table periodically
    
    // Emit metric event
    this.bus.publishMetric({
      deviceId,
      transport,
      ts: recvTs,
      rtt,
      type: 'ack'
    });
  }
  
  recordLoss(deviceId, transport, count) {
    this.bus.publishMetric({
      deviceId,
      transport,
      ts: Date.now(),
      loss: count,
      type: 'loss'
    });
  }
  
  recordJitter(deviceId, transport, jitterMs) {
    this.bus.publishMetric({
      deviceId,
      transport,
      ts: Date.now(),
      jitter: jitterMs,
      type: 'jitter'
    });
  }
}

export const metricsCollector = new MetricsCollector(null, eventBus);

// Exporter runs periodically to aggregate and store
export function metricsExporter(db) {
  setInterval(() => {
    // Aggregate last 60s of RTT samples per device/transport
    const recentPackets = db.prepare(`
      SELECT device_id, transport, rtt_ms, received_at
      FROM packets
      WHERE received_at > ? AND rtt_ms IS NOT NULL
    `).all(Date.now() - 60000);
    
    // Group by device+transport
    const groups = new Map();
    for (const p of recentPackets) {
      const key = `${p.device_id}:${p.transport}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p.rtt_ms);
    }
    
    // Calculate stats per group
    for (const [key, values] of groups.entries()) {
      const [deviceId, transport] = key.split(':');
      if (values.length === 0) continue;
      
      // Sort RTTs
      const sorted = [...values].sort((a,b) => a-b);
      const count = sorted.length;
      const avg = sorted.reduce((a,b) => a+b,0) / count;
      const p50 = sorted[Math.floor(count*0.50)] || 0;
      const p95 = sorted[Math.floor(count*0.95)] || 0;
      const p99 = sorted[Math.floor(count*0.99)] || 0;
      
      // Loss rate (packets with no ACK in window could be approximated)
      const totalPackets = db.prepare(`
        SELECT COUNT(*) as c FROM packets 
        WHERE device_id = ? AND transport = ? AND received_at > ?
      `).get(deviceId, transport, Date.now() - 60000).c;
      
      const ackedPackets = count;
      const lossRate = totalPackets > 0 ? (totalPackets - ackedPackets) / totalPackets : 0;
      
      // Jitter (mean deviation of RTT)
      const jitter = sorted.reduce((sum, val) => sum + Math.abs(val - avg), 0) / count;
      
      // Score (0-100)
      const score = Math.max(0, 100 - Math.round(lossRate*100) - Math.round(jitter) - Math.max(0, avg-200));
      
      // Store in DB
      db.prepare(`
        INSERT INTO transport_metrics (device_id, transport, ts, rtt_avg, rtt_p50, rtt_p95, rtt_p99, loss_rate, jitter, score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(deviceId, transport, Date.now(), avg, p50, p95, p99, lossRate, jitter, score);
      
      // Publish event
      eventBus.publishMetric({
        deviceId, transport, ts: Date.now(),
        rttAvg: avg, rttP50: p50, rttP95: p95, rttP99: p99,
        lossRate, jitter, score
      });
    }
  }, 5000); // Every 5s
}
