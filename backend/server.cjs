// Simple Node.js + Express + sqlite3 backend for ULP data
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, 'ulp.sqlite');

app.use(cors());
// السماح بحجم غير محدود نظريًا (لكن Express و Node لديهم حدود داخلية)
app.use(express.json({ limit: 'Infinity' }));

// Initialize DB and create table if not exists
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) throw err;
  db.run(`CREATE TABLE IF NOT EXISTS ulp_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,
    username TEXT,
    password TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create index for faster search (if not exists)
  db.run('CREATE INDEX IF NOT EXISTS idx_ulp_url ON ulp_entries(url)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ulp_username ON ulp_entries(username)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ulp_password ON ulp_entries(password)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ulp_notes ON ulp_entries(notes)');
});

// Get all entries (ترتيب تصاعدي)
app.get('/api/ulp', (req, res) => {
  db.all('SELECT * FROM ulp_entries ORDER BY created_at ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Search entries (محسّن للأداء + ترتيب تصاعدي + إرجاع كل النتائج عند البحث الفارغ)
app.get('/api/ulp/search', (req, res) => {
  const { q = '', field = 'all' } = req.query;
  let sql, params;
  if (!q) {
    // لو مفيش كلمة بحث رجّع كل النتائج بترتيب تصاعدي
    db.all('SELECT * FROM ulp_entries ORDER BY created_at ASC', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
    return;
  }
  if (field === 'all') {
    sql = `SELECT * FROM ulp_entries WHERE url LIKE ? OR username LIKE ? OR password LIKE ? OR notes LIKE ? ORDER BY created_at ASC LIMIT 200`;
    params = [ `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%` ];
  } else {
    sql = `SELECT * FROM ulp_entries WHERE ${field} LIKE ? ORDER BY created_at ASC LIMIT 200`;
    params = [ `%${q}%` ];
  }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add entries (bulk)
app.post('/api/ulp', (req, res) => {
  const entries = req.body.entries;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries must be array' });
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const stmt = db.prepare('INSERT INTO ulp_entries (url, username, password, notes) VALUES (?, ?, ?, ?)');
    for (const entry of entries) {
      stmt.run(entry.url, entry.username, entry.password, entry.notes || '');
    }
    stmt.finalize((err) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      db.run('COMMIT', (commitErr) => {
        if (commitErr) return res.status(500).json({ error: commitErr.message });
        res.json({ added: entries.length });
      });
    });
  });
});

// Delete all entries and reset id (حذف كل البيانات وإعادة ترقيم id من 1)
app.delete('/api/ulp', (req, res) => {
  db.serialize(() => {
    db.run('DELETE FROM ulp_entries', (err) => {
      if (err) return res.status(500).json({ error: err.message });
      // إعادة تعيين تسلسل id بحذف السطر من sqlite_sequence
      db.run('DELETE FROM sqlite_sequence WHERE name = "ulp_entries"', (seqErr) => {
        if (seqErr) return res.status(500).json({ error: seqErr.message });
        res.json({ success: true });
      });
    });
  });
});

// Export DB file (download)
app.get('/api/ulp/export', (req, res) => {
  res.download(DB_PATH, 'ulp.sqlite');
});

app.listen(PORT, () => {
  console.log(`ULP backend running on http://localhost:${PORT}`);
});
