
const statusEl = document.querySelector('#status');
const dot = document.querySelector('#dot');
const filesEl = document.querySelector('#files');
const connect = document.querySelector('#connect');

let busy = false;

// Menentukan ikon berdasarkan jenis file
function type(m) {
    if (m.includes('folder')) return 'DIR';
    if (m.includes('pdf')) return 'PDF';
    if (m.includes('image')) return 'IMG';

    if (m.includes('spreadsheet') || m.includes('excel')) {
        return 'XLS';
    }

    if (m.includes('document') || m.includes('word')) {
        return 'DOC';
    }

    if (m.includes('presentation')) return 'PPT';

    return 'FILE';
}

// Sinkronisasi Google Drive
async function sync() {
    if (busy || document.hidden) return;

    busy = true;
    statusEl.textContent = 'Menyinkronkan...';

    try {
        const r = await fetch('/api/files', {
            cache: 'no-store'
        });

        // Jika Google Drive belum terhubung
        if (r.status === 401) {
            statusEl.textContent = 'Google Drive belum terhubung';
            dot.className = 'dot bad';
            connect.hidden = false;

            filesEl.replaceChildren();

            const p = document.createElement('p');
            p.className = 'empty';
            p.textContent = 'Hubungkan akun Google untuk membaca folder pribadi.';

            filesEl.append(p);
            return;
        }

        const data = await r.json();

        if (!r.ok) {
            throw Error(data.error || 'Sinkronisasi gagal');
        }

        // Status berhasil
        connect.hidden = true;
        dot.className = 'dot ok';

        statusEl.textContent = `Tersinkron • ${new Date(
            data.syncedAt
        ).toLocaleTimeString('id-ID')} • ${data.files.length} file`;

        filesEl.replaceChildren();

        // Jika folder kosong
        if (!data.files.length) {
            const p = document.createElement('p');

            p.className = 'empty';
            p.textContent = 'Folder masih kosong.';

            filesEl.append(p);
        }

        // Menampilkan daftar file
        for (const f of data.files) {
            const item = document.createElement('div');
            item.className = 'file';

            // Ikon file
            const icon = document.createElement('span');
            icon.className = 'file-icon';
            icon.textContent = type(f.mimeType || '');

            // Informasi file
            const meta = document.createElement('div');
            meta.style.minWidth = '0';

            const name = document.createElement('div');
            name.className = 'file-name';
            name.textContent = f.name;

            const date = document.createElement('div');
            date.className = 'file-date';

            date.textContent = f.createdTime
                ? new Date(f.createdTime).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                })
                : 'Tanggal tidak tersedia';

            meta.append(name, date);

            // Tombol membuka file Google Drive
            const a = document.createElement('a');

            a.textContent = 'VIEW ↗';

            a.href = f.webViewLink ||
                `https://drive.google.com/file/d/${encodeURIComponent(f.id)}/view`;

            a.target = '_blank';
            a.rel = 'noopener noreferrer';

            item.append(icon, meta, a);
            filesEl.append(item);
        }

    } catch (e) {
        dot.className = 'dot bad';
        statusEl.textContent = e.message;

    } finally {
        busy = false;
    }
}

// Tombol sinkronisasi manual
document.querySelector('#sync').addEventListener('click', sync);

// Sinkronisasi ketika tab dashboard dibuka kembali
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        sync();
    }
});

// Sinkronisasi pertama ketika website dibuka
sync();

// Sinkronisasi otomatis setiap 60 detik
setInterval(sync, 60000);
