# Personal Editorial Dashboard

## 1. Persiapan
Install Node.js LTS, buka folder ini di VS Code, buka Terminal > New Terminal, jalankan `npm install`.

## 2. Google Cloud
Buka https://console.cloud.google.com/ dan buat project. Aktifkan Google Drive API. Atur Google Auth Platform / OAuth consent screen, pilih External (untuk akun Gmail pribadi), tambahkan email sendiri sebagai Test user bila aplikasi masih Testing. Buat OAuth Client ID jenis **Web application**. Tambahkan Authorized redirect URI persis `http://localhost:3000/auth/callback`. Salin Client ID dan Client Secret.

## 3. Folder Drive
Buat folder `TUGAS KULIAH` di Google Drive (boleh private). Buka folder dan salin ID dari URL `https://drive.google.com/drive/folders/ID_FOLDER`.

## 4. Environment
Duplikasi `.env.example` menjadi `.env`. Isi GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DRIVE_FOLDER_ID, dan SESSION_SECRET (teks acak panjang). Jangan unggah `.env` ke GitHub.

## 5. Menjalankan
Jalankan `npm run dev` dan buka http://localhost:3000. Klik CONNECT GOOGLE DRIVE, login dengan akun pemilik folder, dan izinkan akses baca Drive. Aplikasi membaca daftar file dari folder tersebut saja; scope izin Google `drive.readonly` secara teknis dapat mengizinkan baca file Drive lain yang dapat diakses akun, walaupun kode ini hanya meminta daftar satu folder. Jangan berikan kredensial pada orang lain.

## 6. Personalisasi
Ganti `Your Name` dan teks profil di `public/index.html`. Ganti URL `src` pada iframe Spotify dengan link embed playlist Anda dari Spotify > Share > Embed playlist. Untuk foto utama: masukkan foto Anda ke `public/assets/profile.jpg`, lalu tambahkan pada `.hero-photo` di CSS `background:linear-gradient(0deg,#0008,transparent),url('/assets/profile.jpg') center/cover;` (menggantikan background lama). Foto referensi tidak digunakan sebagai foto profil karena merupakan screenshot desain, bukan aset foto terpisah.

## Catatan
Aplikasi gratis berjalan di komputer lokal selama terminal aktif. Polling tiap 60 detik hanya ketika tab aktif. OAuth token disimpan dalam sesi server lokal (MemoryStore bawaan Express Session), cocok untuk demo/penggunaan lokal satu pengguna, bukan deployment produksi. Untuk publikasi produksi perlu HTTPS, cookie secure, session store persisten terenkripsi, dan kontrol akses agar pengunjung lain tidak bisa menghubungkan akun mereka atau melihat metadata folder. Google OAuth Testing dapat menyebabkan refresh token kedaluwarsa setelah 7 hari sehingga mungkin perlu login ulang. Spotify embed tunduk pada batasan Spotify. Tidak ada salinan file yang disimpan.
