import express from 'express';
import { Pool } from 'pg';
import crypto from 'node:crypto';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5
});
pool.on('error', (err) => console.error('Academic DB:', err.message));


const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'academic-files';
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const b64 = (s) => Buffer.from(s).toString('base64url');
function sign(value) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || '')
    .update(value).digest('base64url');
}
function validCookie(req) {
  const raw = req.cookies?.owner_session || '';
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const a = Buffer.from(signature), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now();
  } catch { return false; }
}
// Minimal cookie parser, no extra dependency.
router.use((req, _res, next) => {
  req.cookies = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  next();
});
const ownerOnly = (req, res, next) => validCookie(req)
  ? next()
  : res.status(401).json({ error: 'Aksi ini hanya bisa dilakukan pemilik website.' });

async function storageRequest(path, options = {}) {
  if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diatur.');
  return fetch(`${supabaseUrl}/storage/v1${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(options.headers || {})
    }
  });
}
const cleanName = (s) => String(s || '').trim().slice(0, 160);
const idParam = (v) => Number.isInteger(Number(v)) && Number(v) > 0;

router.get('/auth/me', (req, res) => res.json({ owner: validCookie(req) }));
router.post('/auth/login', (req, res) => {
  const password = String(req.body?.password || '');
  const configured = process.env.ADMIN_PASSWORD || '';
  if (!configured) return res.status(503).json({ error: 'ADMIN_PASSWORD belum diatur di environment Vercel.' });
  const a = Buffer.from(password), b = Buffer.from(configured);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
    return res.status(403).json({ error: 'Password pemilik salah.' });
  const payload = b64(JSON.stringify({ exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
  res.setHeader('Set-Cookie', `owner_session=${payload}.${sign(payload)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
  res.json({ ok: true });
});
router.post('/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', 'owner_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});

// Public read: visitors can see the academic information, but cannot mutate it.
router.get('/', async (_req, res) => {
  try {
    const [courses, schedules, tasks, folders, files] = await Promise.all([
      pool.query('SELECT * FROM academic_courses ORDER BY name'),
      pool.query('SELECT * FROM academic_schedules ORDER BY day_of_week, start_time'),
      pool.query('SELECT * FROM academic_tasks ORDER BY completed ASC, deadline ASC NULLS LAST, id DESC'),
      pool.query('SELECT * FROM academic_folders ORDER BY name'),
      pool.query('SELECT id, folder_id, name, mime_type, size_bytes, created_at FROM academic_files ORDER BY created_at DESC')
    ]);
    res.set('Cache-Control', 'no-store');
    res.json({ courses: courses.rows, schedules: schedules.rows, tasks: tasks.rows, folders: folders.rows, files: files.rows, owner: validCookie(_req) });
  } catch (e) {
    console.error('Academic read:', e.message);
    res.status(500).json({ error: 'Gagal mengambil data akademik. Pastikan SQL migration sudah dijalankan.' });
  }
});

router.post('/courses', ownerOnly, async (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Nama mata kuliah wajib diisi.' });
  try {
    const r = await pool.query('INSERT INTO academic_courses(name, lecturer) VALUES($1,$2) RETURNING *', [name, cleanName(req.body?.lecturer) || null]);
    res.status(201).json(r.rows[0]);
  } catch { res.status(500).json({ error: 'Gagal menambah mata kuliah.' }); }
});
router.put('/courses/:id', ownerOnly, async (req, res) => {
  if (!idParam(req.params.id)) return res.status(400).json({ error: 'ID tidak valid.' });
  try {
    const r = await pool.query('UPDATE academic_courses SET name=$1, lecturer=$2 WHERE id=$3 RETURNING *', [cleanName(req.body?.name), cleanName(req.body?.lecturer) || null, req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Mata kuliah tidak ditemukan.' });
    res.json(r.rows[0]);
  } catch { res.status(500).json({ error: 'Gagal mengubah mata kuliah.' }); }
});
router.delete('/courses/:id', ownerOnly, async (req, res) => {
  try { await pool.query('DELETE FROM academic_courses WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch { res.status(500).json({ error: 'Mata kuliah masih dipakai jadwal/tugas atau gagal dihapus.' }); }
});

router.post('/schedules', ownerOnly, async (req, res) => {
  const { course_id, day_of_week, start_time, end_time, room } = req.body || {};
  if (!course_id || ![0,1,2,3,4,5,6].includes(Number(day_of_week)) || !start_time || !end_time)
    return res.status(400).json({ error: 'Mata kuliah, hari, jam mulai, dan jam selesai wajib diisi.' });
  try {
    const r = await pool.query('INSERT INTO academic_schedules(course_id,day_of_week,start_time,end_time,room) VALUES($1,$2,$3,$4,$5) RETURNING *', [course_id, day_of_week, start_time, end_time, cleanName(room) || null]);
    res.status(201).json(r.rows[0]);
  } catch { res.status(500).json({ error: 'Gagal menambah jadwal.' }); }
});
router.put('/schedules/:id', ownerOnly, async (req, res) => {
  const { course_id, day_of_week, start_time, end_time, room } = req.body || {};
  try {
    const r = await pool.query('UPDATE academic_schedules SET course_id=$1,day_of_week=$2,start_time=$3,end_time=$4,room=$5 WHERE id=$6 RETURNING *', [course_id, day_of_week, start_time, end_time, cleanName(room) || null, req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Jadwal tidak ditemukan.' });
    res.json(r.rows[0]);
  } catch { res.status(500).json({ error: 'Gagal mengubah jadwal.' }); }
});
router.delete('/schedules/:id', ownerOnly, async (req, res) => {
  try { await pool.query('DELETE FROM academic_schedules WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch { res.status(500).json({ error: 'Gagal menghapus jadwal.' }); }
});

router.post('/tasks', ownerOnly, async (req, res) => {
  const title = cleanName(req.body?.title);
  if (!title) return res.status(400).json({ error: 'Judul tugas wajib diisi.' });
  try {
    const r = await pool.query('INSERT INTO academic_tasks(course_id,title,description,deadline) VALUES($1,$2,$3,$4) RETURNING *', [req.body?.course_id || null, title, String(req.body?.description || '').slice(0,3000) || null, req.body?.deadline || null]);
    res.status(201).json(r.rows[0]);
  } catch { res.status(500).json({ error: 'Gagal menambah tugas.' }); }
});
router.put('/tasks/:id', ownerOnly, async (req, res) => {
  try {
    const r = await pool.query('UPDATE academic_tasks SET course_id=$1,title=$2,description=$3,deadline=$4,completed=$5 WHERE id=$6 RETURNING *', [req.body?.course_id || null, cleanName(req.body?.title), String(req.body?.description || '').slice(0,3000) || null, req.body?.deadline || null, !!req.body?.completed, req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Tugas tidak ditemukan.' });
    res.json(r.rows[0]);
  } catch { res.status(500).json({ error: 'Gagal mengubah tugas.' }); }
});
router.patch('/tasks/:id/complete', ownerOnly, async (req, res) => {
  try {
    const r = await pool.query('UPDATE academic_tasks SET completed=$1 WHERE id=$2 RETURNING *', [!!req.body?.completed, req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Tugas tidak ditemukan.' });
    res.json(r.rows[0]);
  } catch { res.status(500).json({ error: 'Gagal mengubah status tugas.' }); }
});
router.delete('/tasks/:id', ownerOnly, async (req, res) => {
  try { await pool.query('DELETE FROM academic_tasks WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch { res.status(500).json({ error: 'Gagal menghapus tugas.' }); }
});

router.post('/folders', ownerOnly, async (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Nama folder wajib diisi.' });
  try {
    const r = await pool.query('INSERT INTO academic_folders(name,parent_id) VALUES($1,$2) RETURNING *', [name, req.body?.parent_id || null]);
    res.status(201).json(r.rows[0]);
  } catch { res.status(500).json({ error: 'Gagal membuat folder.' }); }
});
router.put('/folders/:id', ownerOnly, async (req, res) => {
  try {
    const r = await pool.query('UPDATE academic_folders SET name=$1 WHERE id=$2 RETURNING *', [cleanName(req.body?.name), req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Folder tidak ditemukan.' });
    res.json(r.rows[0]);
  } catch { res.status(500).json({ error: 'Gagal mengubah folder.' }); }
});
router.delete('/folders/:id', ownerOnly, async (req, res) => {
  try {
    const count = await pool.query('SELECT (SELECT count(*) FROM academic_folders WHERE parent_id=$1) + (SELECT count(*) FROM academic_files WHERE folder_id=$1) AS total', [req.params.id]);
    if (Number(count.rows[0].total)) return res.status(409).json({ error: 'Folder masih berisi folder/file. Kosongkan dulu.' });
    await pool.query('DELETE FROM academic_folders WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Gagal menghapus folder.' }); }
});

router.post('/files', ownerOnly, async (req, res) => {
  if (!req.body?.file_data || !req.body?.name) return res.status(400).json({ error: 'Pilih file terlebih dahulu.' });
  const buffer = Buffer.from(String(req.body.file_data).replace(/^data:[^,]*;base64,/, ''), 'base64');
  if (!buffer.length || buffer.length > 3 * 1024 * 1024) return res.status(413).json({ error: 'Ukuran file maksimal 3 MB.' });
  const id = crypto.randomUUID();
  const safeName = String(req.body.name).replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0,150);
  const mimeType = String(req.body.mime_type || 'application/octet-stream').slice(0,120);
  const path = `${id}/${safeName}`;
  try {
    const up = await storageRequest(`/object/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: { 'Content-Type': mimeType, 'x-upsert': 'false' },
      body: buffer
    });
    if (!up.ok) throw new Error(`Storage upload gagal (${up.status}): ${await up.text()}`);
    const r = await pool.query('INSERT INTO academic_files(id,folder_id,name,mime_type,size_bytes,storage_path) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,folder_id,name,mime_type,size_bytes,created_at', [id, req.body.folder_id || null, safeName, mimeType, buffer.length, path]);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    console.error('File upload:', e.message);
    res.status(500).json({ error: 'Upload gagal. Pastikan bucket Supabase tersedia dan policy/service key benar.' });
  }
});
router.get('/files/:id/url', async (req, res) => {
  try {
    const r = await pool.query('SELECT storage_path FROM academic_files WHERE id=$1', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'File tidak ditemukan.' });
    const signed = await storageRequest(`/object/sign/${encodeURIComponent(bucket)}/${r.rows[0].storage_path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 300 })
    });
    const data = await signed.json();
    if (!signed.ok) throw new Error(data.message || 'Gagal membuat link file.');
    res.json({ url: `${supabaseUrl}/storage/v1${data.signedURL}` });
  } catch (e) { console.error('File URL:', e.message); res.status(500).json({ error: 'Gagal membuka file.' }); }
});
router.put('/files/:id', ownerOnly, async (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Nama file wajib diisi.' });
  try {
    const r = await pool.query('UPDATE academic_files SET name=$1 WHERE id=$2 RETURNING id,folder_id,name,mime_type,size_bytes,created_at', [name, req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'File tidak ditemukan.' });
    res.json(r.rows[0]);
  } catch { res.status(500).json({ error: 'Gagal mengubah nama file.' }); }
});
router.delete('/files/:id', ownerOnly, async (req, res) => {
  try {
    const r = await pool.query('SELECT storage_path FROM academic_files WHERE id=$1', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'File tidak ditemukan.' });
    const del = await storageRequest(`/object/${encodeURIComponent(bucket)}/${r.rows[0].storage_path.split('/').map(encodeURIComponent).join('/')}`, { method: 'DELETE' });
    if (!del.ok) throw new Error(`Storage delete ${del.status}`);
    await pool.query('DELETE FROM academic_files WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { console.error('File delete:', e.message); res.status(500).json({ error: 'Gagal menghapus file.' }); }
});

export default router;
