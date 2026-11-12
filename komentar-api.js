
import express from 'express';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const router = express.Router();

// Membuat folder database secara otomatis
const dataDir = path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'komentar.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS komentar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    isi TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`);

const ambilKomentar = db.prepare(`
  SELECT id, nama, isi, created_at, updated_at
  FROM komentar
  ORDER BY id DESC
`);

const tokenHash = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const cekToken = (req, res, next) => {
  const id = Number(req.params.id);
  const token = req.get('X-Comment-Token');

  if (!Number.isInteger(id) || id < 1 || !token) {
    return res.status(400).json({
      error: 'ID atau token komentar tidak valid.'
    });
  }

  const komentar = db.prepare(
    'SELECT id, token_hash FROM komentar WHERE id = ?'
  ).get(id);

  if (!komentar) {
    return res.status(404).json({
      error: 'Komentar tidak ditemukan.'
    });
  }

  const hash = tokenHash(token);
  const a = Buffer.from(hash);
  const b = Buffer.from(komentar.token_hash);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({
      error: 'Token salah. Komentar ini tidak bisa diubah oleh perangkat ini.'
    });
  }

  req.komentarId = id;
  next();
};

// GET: tampilkan semua komentar
router.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(ambilKomentar.all());
});

// POST: tambah komentar
router.post('/', (req, res) => {
  const nama = typeof req.body?.nama === 'string'
    ? req.body.nama.trim()
    : '';

  const isi = typeof req.body?.isi === 'string'
    ? req.body.isi.trim()
    : '';

  if (!nama || !isi) {
    return res.status(400).json({
      error: 'Nama dan komentar wajib diisi.'
    });
  }

  if (nama.length > 60 || isi.length > 2000) {
    return res.status(400).json({
      error: 'Nama maksimal 60 karakter dan komentar maksimal 2000 karakter.'
    });
  }

  const token = crypto.randomBytes(32).toString('hex');

  const result = db.prepare(`
    INSERT INTO komentar (nama, isi, token_hash)
    VALUES (?, ?, ?)
  `).run(nama, isi, tokenHash(token));

  const komentar = db.prepare(`
    SELECT id, nama, isi, created_at, updated_at
    FROM komentar WHERE id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ ...komentar, token });
});

// PUT: edit komentar milik pemilik token
router.put('/:id', cekToken, (req, res) => {
  const nama = typeof req.body?.nama === 'string'
    ? req.body.nama.trim()
    : '';

  const isi = typeof req.body?.isi === 'string'
    ? req.body.isi.trim()
    : '';

  if (!nama || !isi) {
    return res.status(400).json({
      error: 'Nama dan komentar wajib diisi.'
    });
  }

  if (nama.length > 60 || isi.length > 2000) {
    return res.status(400).json({
      error: 'Nama maksimal 60 karakter dan komentar maksimal 2000 karakter.'
    });
  }

  db.prepare(`
    UPDATE komentar
    SET nama = ?, isi = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(nama, isi, req.komentarId);

  const komentar = db.prepare(`
    SELECT id, nama, isi, created_at, updated_at
    FROM komentar WHERE id = ?
  `).get(req.komentarId);

  res.json(komentar);
});

// DELETE: hapus komentar milik pemilik token
router.delete('/:id', cekToken, (req, res) => {
  db.prepare('DELETE FROM komentar WHERE id = ?')
    .run(req.komentarId);

  res.json({ ok: true });
});

export default router;
