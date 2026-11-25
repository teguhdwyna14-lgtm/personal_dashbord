
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import komentarAPI from './komentar-api.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.disable('x-powered-by');

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'development-only-change-me',
    resave: false,
    saveUninitialized: false,
cookie: {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 86400000
}
  })
);

// Membaca request JSON
app.use(express.json({ limit: '5mb' }));

// Menampilkan file frontend
app.use(express.static('public'));

// Academic manager API (Supabase + owner-only mutations)
app.use('/api/academic', academicAPI);

// API komentar: tambah, tampilkan, edit, dan hapus
app.use('/api/komentar', komentarAPI);

// Jalankan server — letakkan paling bawah
// Jalankan server — letakkan paling bawah
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
  });
}

export default app;