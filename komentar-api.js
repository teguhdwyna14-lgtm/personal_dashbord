
import express from 'express';
import { Pool } from 'pg';
import crypto from 'node:crypto';

const router = express.Router();

// Koneksi ke Supabase PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 5
});

pool.on('error', (error) => {
  console.error('Database connection error:', error.message);
});

// Mengambil semua komentar
router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');

    const result = await pool.query(`
      SELECT id, nama, isi, created_at, updated_at
      FROM komentar
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('GET komentar:', error.message);
    res.status(500).json({
      error: 'Gagal mengambil komentar.'
    });
  }
});

// Hash token
const tokenHash = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

// Memeriksa kepemilikan komentar
const cekToken = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const token = req.get('X-Comment-Token');

    if (!Number.isInteger(id) || id < 1 || !token) {
      return res.status(400).json({
        error: 'ID atau token komentar tidak valid.'
      });
    }

    const result = await pool.query(
      'SELECT id, token_hash FROM komentar WHERE id = $1',
      [id]
    );

    const komentar = result.rows[0];

    if (!komentar) {
      return res.status(404).json({
        error: 'Komentar tidak ditemukan.'
      });
    }

    const a = Buffer.from(tokenHash(token));
    const b = Buffer.from(komentar.token_hash);

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(403).json({
        error: 'Token salah. Komentar ini tidak bisa diubah oleh perangkat ini.'
      });
    }

    req.komentarId = id;
    next();
  } catch (error) {
    console.error('Cek token:', error.message);
    res.status(500).json({
      error: 'Gagal memeriksa token komentar.'
    });
  }
};

// POST: tambah komentar
router.post('/', async (req, res) => {
  try {
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

    const result = await pool.query(`
      INSERT INTO komentar (nama, isi, token_hash)
      VALUES ($1, $2, $3)
      RETURNING id, nama, isi, created_at, updated_at
    `, [nama, isi, tokenHash(token)]);

    res.status(201).json({
      ...result.rows[0],
      token
    });
  } catch (error) {
    console.error('POST komentar:', error.message);
    res.status(500).json({
      error: 'Gagal menambahkan komentar.'
    });
  }
});

// PUT: edit komentar
router.put('/:id', cekToken, async (req, res) => {
  try {
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

    const result = await pool.query(`
      UPDATE komentar
      SET nama = $1,
          isi = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, nama, isi, created_at, updated_at
    `, [nama, isi, req.komentarId]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('PUT komentar:', error.message);
    res.status(500).json({
      error: 'Gagal mengubah komentar.'
    });
  }
});

// DELETE: hapus komentar
router.delete('/:id', cekToken, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM komentar WHERE id = $1',
      [req.komentarId]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE komentar:', error.message);
    res.status(500).json({
      error: 'Gagal menghapus komentar.'
    });
  }
});

export default router;
