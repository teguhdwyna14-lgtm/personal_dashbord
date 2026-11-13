
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import { google } from 'googleapis';
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
app.use(express.json());

// Menampilkan file frontend
app.use(express.static('public'));

// Google OAuth
const oauth = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/public/index.html');
});
// Login Google
app.get('/auth/google', (req, res) => {
  const client = oauth();

  res.redirect(
    client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/drive.readonly']
    })
  );
});

// Callback login Google
app.get('/auth/callback', async (req, res) => {
  try {
    if (!req.query.code) {
      return res.redirect('/?error=oauth');
    }

    const client = oauth();
    const { tokens } = await client.getToken(String(req.query.code));

    req.session.tokens = tokens;

    res.redirect('/');
  } catch (error) {
    console.error('Google OAuth error:', error.message);
    res.redirect('/?error=oauth');
  }
});

// Mengambil daftar file Google Drive
app.get('/api/files', async (req, res) => {
  if (!req.session.tokens) {
    return res.status(401).json({
      connected: false,
      files: []
    });
  }

  try {
    const client = oauth();
    client.setCredentials(req.session.tokens);

    client.on('tokens', (tokens) => {
      req.session.tokens = {
        ...req.session.tokens,
        ...tokens
      };
    });

    const drive = google.drive({
      version: 'v3',
      auth: client
    });

    const folder = process.env.DRIVE_FOLDER_ID;

    if (!folder) {
      return res.status(500).json({
        error: 'DRIVE_FOLDER_ID belum diisi'
      });
    }

    let files = [];
    let pageToken;

    do {
      const result = await drive.files.list({
        q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed = false`,
        fields:
          'nextPageToken,files(id,name,mimeType,createdTime,webViewLink,iconLink)',
        orderBy: 'createdTime desc',
        pageSize: 100,
        pageToken
      });

      files.push(...(result.data.files || []));
      pageToken = result.data.nextPageToken;
    } while (pageToken);

    res.set('Cache-Control', 'no-store');

    res.json({
      connected: true,
      files,
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Google Drive error:', error.message);

    res.status(502).json({
      error: 'Gagal membaca Drive. Periksa izin akun dan folder.'
    });
  }
});

// Logout Google
app.post('/auth/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        error: 'Gagal logout'
      });
    }

    res.json({ ok: true });
  });
});

// API komentar: tambah, tampilkan, edit, dan hapus
app.use('/api/komentar', komentarAPI);

// Jalankan server — letakkan paling bawah
// Jalankan server — letakkan paling bawah
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});
export default app;