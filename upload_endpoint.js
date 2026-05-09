import multer from 'multer';

const upload = multer({ dest:'uploads/' });

app.post('/api/ota/upload', upload.single('firmware'), (req,res)=>{

  const id = storage.db.prepare(`
    INSERT INTO firmware (filename,size,uploaded_at)
    VALUES (?,?,?)
  `).run(req.file.filename, req.file.size, Date.now()).lastInsertRowid;

  res.json({ id });
});
