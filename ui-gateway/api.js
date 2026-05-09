export function attachAPI(app, storage) {
  app.get('/api/packets', (req, res) => {
    res.json({ ok:true });
  });
}