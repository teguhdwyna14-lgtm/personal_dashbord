
const API_KOMENTAR = '/api/komentar';
const TOKEN_KEY = 'tokenKomentarDashboard';

function ambilTokenKomentar() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}');
  } catch {
    return {};
  }
}

function simpanTokenKomentar(id, token) {
  const tokens = ambilTokenKomentar();
  tokens[id] = token;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

async function muatKomentar() {
  const daftar = document.getElementById('daftarKomentar');
  const jumlah = document.getElementById('jumlahKomentar');

  if (!daftar) return;

  try {
    const response = await fetch(API_KOMENTAR);
    if (!response.ok) throw new Error('Gagal mengambil komentar');

    const komentar = await response.json();

    if (jumlah) jumlah.textContent = komentar.length;

    daftar.replaceChildren();

    if (komentar.length === 0) {
      const kosong = document.createElement('p');
      kosong.textContent = 'Belum ada komentar.';
      daftar.appendChild(kosong);
      return;
    }

    const tokens = ambilTokenKomentar();

    komentar.forEach((item) => {
      const wadah = document.createElement('article');
      const nama = document.createElement('h4');
      const isi = document.createElement('p');
      const tanggal = document.createElement('small');

      nama.textContent = item.nama;
      isi.textContent = item.isi;
      tanggal.textContent = item.created_at || '';

      wadah.append(nama, isi, tanggal);

      if (tokens[item.id]) {
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Edit';

        edit.addEventListener('click', async () => {
          const namaBaru = prompt('Nama:', item.nama);
          if (namaBaru === null) return;

          const isiBaru = prompt('Komentar:', item.isi);
          if (isiBaru === null) return;

          try {
            const hasil = await fetch(
              `${API_KOMENTAR}/${item.id}`,
              {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Comment-Token': tokens[item.id]
                },
                body: JSON.stringify({
                  nama: namaBaru,
                  isi: isiBaru
                })
              }
            );

            const data = await hasil.json();
            if (!hasil.ok) throw new Error(data.error);

            await muatKomentar();
          } catch (error) {
            alert(error.message || 'Gagal mengedit komentar.');
          }
        });

        const hapus = document.createElement('button');
        hapus.type = 'button';
        hapus.textContent = 'Hapus';

        hapus.addEventListener('click', async () => {
          if (!confirm('Yakin mau menghapus komentar ini?')) return;

          try {
            const hasil = await fetch(
              `${API_KOMENTAR}/${item.id}`,
              {
                method: 'DELETE',
                headers: {
                  'X-Comment-Token': tokens[item.id]
                }
              }
            );

            const data = await hasil.json();
            if (!hasil.ok) throw new Error(data.error);

            delete tokens[item.id];
            localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));

            await muatKomentar();
          } catch (error) {
            alert(error.message || 'Gagal menghapus komentar.');
          }
        });

        wadah.append(edit, hapus);
      }

      daftar.appendChild(wadah);
    });
  } catch (error) {
    console.error(error);
    const pesan = document.createElement('p');
    pesan.textContent = 'Komentar gagal dimuat. Periksa koneksi server.';
    daftar.replaceChildren(pesan);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formKomentar');

  if (!form) {
    console.error('Form komentar #formKomentar tidak ditemukan.');
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const namaInput = document.getElementById('namaKomentar');
    const isiInput = document.getElementById('isiKomentar');
    const status = document.getElementById('statusKomentar');
    const tombol = document.getElementById('kirimKomentar');

    const nama = namaInput?.value.trim();
    const isi = isiInput?.value.trim();

    if (!nama || !isi) {
      if (status) status.textContent = 'Nama dan komentar wajib diisi.';
      return;
    }

    if (tombol) tombol.disabled = true;
    if (status) status.textContent = 'Mengirim komentar...';

    try {
      const response = await fetch(API_KOMENTAR, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nama, isi })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengirim.');

      if (data.token) simpanTokenKomentar(data.id, data.token);

      form.reset();

      if (status) status.textContent = 'Komentar berhasil dikirim!';
      await muatKomentar();
    } catch (error) {
      console.error(error);
      if (status) {
        status.textContent = error.message || 'Komentar gagal dikirim.';
      }
    } finally {
      if (tombol) tombol.disabled = false;
    }
  });

  muatKomentar();
});
