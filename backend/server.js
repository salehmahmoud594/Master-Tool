// Simple Node.js + Express + sqlite3 backend for ULP data
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, 'ulp.sqlite');

app.use(cors());
app.use(express.json());

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
});

// Get all entries
app.get('/api/ulp', (req, res) => {
  db.all('SELECT * FROM ulp_entries ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Search entries
app.get('/api/ulp/search', (req, res) => {
  const { q = '', field = 'all' } = req.query;
  let sql, params;
  if (field === 'all') {
    sql = `SELECT * FROM ulp_entries WHERE url LIKE ? OR username LIKE ? OR password LIKE ? OR notes LIKE ? ORDER BY created_at DESC`;
    params = [ `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%` ];
  } else {
    sql = `SELECT * FROM ulp_entries WHERE ${field} LIKE ? ORDER BY created_at DESC`;
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
  const stmt = db.prepare('INSERT INTO ulp_entries (url, username, password, notes) VALUES (?, ?, ?, ?)');
  db.serialize(() => {
    for (const entry of entries) {
      stmt.run(entry.url, entry.username, entry.password, entry.notes || '');
    }
    stmt.finalize((err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ added: entries.length });
    });
  });
});

// Delete all entries and reset id
app.delete('/api/ulp', (req, res) => {
  db.serialize(() => {
    db.run('DROP TABLE IF EXISTS ulp_entries');
    db.run(`CREATE TABLE IF NOT EXISTS ulp_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT,
      username TEXT,
      password TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
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
