import { eventBus } from '../ui-gateway/events.js';

// (کد قبلی transport_metrics aggregation همان است) + افزودن memory_metrics

export function metricsExporter(db) {
  setInterval(() => {
    const now = Date.now();
    const since60s = now - 60000;
    
    // ──────────────────────────────────────────────────────────
    // 1) AGGREGATE TRANSPORT METRICS (60s window)
    // ──────────────────────────────────────────────────────────
    const recentPackets = db.prepare(`
      SELECT device_id, transport, rtt_ms, received_at
      FROM packets
      WHERE received_at > ? AND rtt_ms IS NOT NULL
    `).all(since60s);
    
    const groups = new Map();
    for (const p of recentPackets) {
      const key = `${p.device_id}:${p.transport}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p.rtt_ms);
    }
    
    for (const [key, values] of groups.entries()) {
      const [deviceId, transport] = key.split(':');
      if (values.length === 0) continue;
      
      const sorted = [...values].sort((a,b) => a-b);
      const count = sorted.length;
      const avg = sorted.reduce((a,b) => a+b,0) / count;
      const p50 = sorted[Math.floor(count*0.50)] || 0;
      const p95 = sorted[Math.floor(count*0.95)] || 0;
      const p99 = sorted[Math.floor(count*0.99)] || 0;
      
      const totalPackets = db.prepare(`
        SELECT COUNT(*) as c FROM packets 
        WHERE device_id = ? AND transport = ? AND received_at > ?
      `).get(deviceId, transport, since60s).c;
      
      const ackedPackets = count;
      const lossRate = totalPackets > 0 ? (totalPackets - ackedPackets) / totalPackets : 0;
      
      const jitter = sorted.reduce((sum, val) => sum + Math.abs(val - avg), 0) / count;
      
      const score = Math.max(0, 100 - Math.round(lossRate*100) - Math.round(jitter) - Math.max(0, avg-200));
      
      db.prepare(`
        INSERT INTO transport_metrics (device_id, transport, ts, rtt_avg, rtt_p50, rtt_p95, rtt_p99, loss_rate, jitter, score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(deviceId, transport, now, avg, p50, p95, p99, lossRate, jitter, score);
      
      eventBus.publishMetric({
        deviceId, transport, ts: now,
        rttAvg: avg, rttP50: p50, rttP95: p95, rttP99: p99,
        lossRate, jitter, score, type: 'transport'
      });
    }
    
    // ──────────────────────────────────────────────────────────
    // 2) AGGREGATE MEMORY METRICS (60s window)
    // ──────────────────────────────────────────────────────────
    const recentMemory = db.prepare(`
      SELECT device_id, ts, free_heap_kb, min_heap_kb, fragmentation_pct, largest_free_block_kb, watchdog_near_trigger, tasks, queues
      FROM memory_metrics
      WHERE ts > ?
    `).all(since60s);
    
    // Group by device
    const memByDevice = new Map();
    for (const m of recentMemory) {
      if (!memByDevice.has(m.device_id)) memByDevice.set(m.device_id, []);
      memByDevice.get(m.device_id).push(m);
    }
    
    for (const [deviceId, arr] of memByDevice.entries()) {
      if (arr.length === 0) continue;
      // Simple aggregation: latest snapshot (you can compute trends if needed)
      const latest = arr[arr.length - 1];
      eventBus.publishMetric({
        deviceId,
        ts: latest.ts,
        type: 'memory',
        free_heap_kb: latest.free_heap_kb,
        min_heap_kb: latest.min_heap_kb,
        fragmentation_pct: latest.fragmentation_pct,
        largest_free_block_kb: latest.largest_free_block_kb,
        watchdog_near_trigger: !!latest.watchdog_near_trigger,
        tasks: latest.tasks ? JSON.parse(latest.tasks) : null,
        queues: latest.queues ? JSON.parse(latest.queues) : null
      });
    }
    
  }, 5000);
}

