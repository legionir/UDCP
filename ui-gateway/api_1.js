export function attachAPI(app, storage) {

  app.get('/api/packets', (req, res) => {
    res.json({ ok:true });
  });

  app.get('/api/devices', (req, res) => {
    const rows = storage.db.prepare(`
      SELECT device_id, MAX(received_at) as lastSeen
      FROM packets
      GROUP BY device_id
    `).all();

    const devices = rows.map(r => ({
      id: r.device_id,
      name: r.device_id,
      status: Date.now() - r.lastSeen < 5000 ? 'online' : 'offline',
      lastSeen: r.lastSeen,
      platform: 'esp32',
      firmware: 'v5',
      uptime: 0,
      heap: { free: 180000, min: 150000, frag: 5 },
      transport: {
        udp: { score: 90, rtt: 10 },
        ws: { score: 70, rtt: 30 },
        http: { score: 100, rtt: 80 }
      },
      metrics: { fps: 50, loss: 0, jitter: 2 }
    }));

    res.json(devices);
  });
}

---

# ✅ FRONTEND - Phase 1 کامل

---