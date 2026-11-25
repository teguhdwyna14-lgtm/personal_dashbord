# Personal Dashboard — Academic Manager

Project ini mengganti panel Google Drive dengan jadwal kuliah, task manager, serta arsip folder/file menggunakan Supabase. Website tetap menggunakan HTML/CSS/JavaScript, Express, dan PostgreSQL.

## 1. Siapkan Supabase

1. Buka **Supabase → SQL Editor**.
2. Buka file `supabase-academic.sql` dari project ini, salin seluruh isinya, lalu jalankan sekali.
3. Pastikan Storage bucket `academic-files` terbentuk sebagai **private**.
4. Buka **Project Settings → Database** dan salin connection string PostgreSQL.
5. Buka **Project Settings → API** dan siapkan Project URL serta `service_role` key.

Jangan pernah menaruh `service_role` key di file frontend, GitHub, atau variabel `NEXT_PUBLIC_*`. Key ini hanya dipakai backend.

## 2. Environment Variables

Tambahkan variabel berikut pada Vercel → Project → Settings → Environment Variables (Production, Preview bila perlu):

- `DATABASE_URL`: Supabase PostgreSQL connection string.
- `SUPABASE_URL`: URL project Supabase, misalnya `https://xxxx.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY`: service role key Supabase (rahasia).
- `SUPABASE_STORAGE_BUCKET`: `academic-files`.
- `ADMIN_PASSWORD`: password kuat khusus pemilik dashboard.
- `SESSION_SECRET`: string acak panjang minimal 32 karakter.

Untuk lokal, salin `.env.example` menjadi `.env` dan isi nilai yang sama. Jangan commit `.env`.

## 3. Deploy

1. Jalankan `npm install`.
2. Jalankan `npm run dev` untuk pengujian lokal.
3. Commit dan push perubahan ke repository Git yang terhubung ke Vercel, atau deploy ulang sesuai workflow project sebelumnya.
4. Setelah mengubah Environment Variables di Vercel, lakukan redeploy.

## 4. Cara menggunakan

- **Jadwal:** tambah mata kuliah dan jadwal. Klik nama mata kuliah untuk melihat tugas yang terkait.
- **Daftar tugas:** tambah, edit, hapus, dan centang tugas yang selesai. Tugas selesai tetap disimpan dan dicoret, bukan dihapus.
- **File & folder:** buat folder, buka folder, upload file, rename, buka, dan hapus file/folder.
- **Pengingat:** tugas dengan deadline hari ini atau besok akan ditampilkan sebagai peringatan. Browser notification akan muncul jika izin notifikasi telah diberikan.

Upload file dibatasi maksimal 3 MB per file agar kompatibel dengan batas payload serverless Vercel.

## 5. Keamanan

- Pengunjung dapat melihat konten akademik yang ditampilkan, tetapi seluruh endpoint tambah/edit/hapus/upload dilindungi autentikasi pemilik di backend.
- Login pemilik menggunakan `ADMIN_PASSWORD`; cookie sesi ditandatangani menggunakan `SESSION_SECRET`, HttpOnly, Secure, dan SameSite=Lax.
- File disimpan dalam bucket Supabase private. Backend membuat signed URL sementara untuk membuka file.
- Jangan membagikan password pemilik atau `SUPABASE_SERVICE_ROLE_KEY`.
- Gunakan password unik dan `SESSION_SECRET` acak. Ganti keduanya jika pernah terekspos.

## 6. Catatan

Project lama memiliki integrasi Google Drive. Integrasi OAuth dan panel sinkronisasi telah dilepas dari tampilan serta backend akademik. Fitur Pesan & Kesan tetap dipertahankan.
