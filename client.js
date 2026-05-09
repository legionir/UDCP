const ws = new WebSocket('ws://localhost:8080', ['udcp-binary']);
ws.binaryType = 'arraybuffer';

ws.onmessage = (e) => {
  if (e.data instanceof ArrayBuffer) {
    const view = new DataView(e.data);

    const seq = view.getUint32(0);
    const ax = view.getFloat32(4);

    console.log(seq, ax);
  }
};

## storage

db.exec(`
CREATE TABLE IF NOT EXISTS firmware (
  id INTEGER PRIMARY KEY,
  filename TEXT,
  size INTEGER,
  uploaded_at INTEGER
);
`);

