app.get('/api/replay', (req, res) => {
  const rows = storage.db.prepare(`
    SELECT * FROM packets ORDER BY received_at ASC LIMIT 1000
  `).all();

  res.json({
    startTime: rows[0]?.received_at || 0,
    endTime: rows[rows.length-1]?.received_at || 0,
    packets: rows.map(r => ({
      timestamp: r.received_at,
      streamId: r.stream_id,
      payload: JSON.parse(r.payload)
    }))
  });
});
