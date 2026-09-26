# System TU Management — SDIT As-Salam Islamic Green School

Sistem Informasi Tata Usaha: Buku Induk siswa, pembayaran SPP bulanan, ekskul,
dan panel administrator. Dibangun dengan React + Vite, data tersimpan di
**Supabase** (PostgreSQL) dengan penyimpanan lokal sebagai cadangan.

## Fitur

| Modul | Isi |
| --- | --- |
| **Dashboard** | Ringkasan tagihan, pembayaran, piutang, chart per bulan, insight per kelas |
| **Buku Induk** | Master data 1.200+ siswa, pencarian, filter kelas/rombel/tahun ajaran, import & export Excel |
| **Pembayaran** | Pencatatan SPP per bulan, peta warna bulanan (merah/kuning/hijau), riwayat + pagination |
| **Ekskul** | Pendaftaran ekskul (13 pilihan + biaya), pembayaran per bulan, riwayat |
| **Pengaturan** | Ubah tarif SPP per angkatan dan biaya tiap ekskul (plus tambah/hapus angkatan & ekskul) |
| **Admin Panel** | Kelola pengguna, hak akses per role & per pengguna, hapus massal per kelas/tahun ajaran (tema gelap) |
| **Keamanan** | Login 3x salah → akun terkunci, popup ganti password, verifikasi password tiap 3 jam, auto logout 1 menit |

## Menjalankan

```bash
npm install
cp .env.example .env    # isi URL & anon key Supabase
npm run dev             # http://localhost:5174
```

### 1. Siapkan database Supabase

1. Buka **Supabase Dashboard → project → SQL Editor → New query**.
2. Tempel seluruh isi [`supabase/schema.sql`](supabase/schema.sql) lalu **RUN**.
3. Ambil kredensial dari **Project Settings → API** dan isikan ke `.env`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

Bila `.env` belum diisi, aplikasi tetap berjalan penuh dalam **mode lokal**
(localStorage) dan indikator di header menampilkan “Mode lokal”.

Saat pertama dibuka, data hasil import Excel otomatis diunggah ke Supabase bila
tabelnya masih kosong.

### 2. Import data Buku Induk (opsional)

```bash
BUKU_INDUK_PATH="/path/ke/BUKU INDUK SISWA.xlsx" npm run seed
```

## Deploy ke Netlify (online)

1. Buka <https://app.netlify.com/start> → **Import an existing project** → **GitHub**.
2. Pilih repo **`yunitaeka12/system_tu_management`** (branch `main`).
   Netlify sudah otomatis membaca `netlify.toml`:
   build command `npm run build`, publish directory `dist`.
3. Buka **Site configuration → Environment variables → Add a variable**, lalu tambahkan dua nilai
   dari Supabase (**Project Settings → API**):

   | Key | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://ojuwshddsocrjajkhlbv.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | anon public key project Anda |

4. Klik **Deploy site**. Setiap `git push` ke `main` akan otomatis ter-deploy ulang.

### Hal penting soal environment variable

- Vite hanya meneruskan variabel yang berawalan **`VITE_`** ke kode, dan nilainya
  **dibekukan saat build**. Jadi setelah menambah/mengubah variabel, lakukan
  **Deploys → Trigger deploy → Clear cache and deploy site**.
- `VITE_SUPABASE_ANON_KEY` **bukan rahasia** (memang dipakai di sisi browser).
  Yang melindungi data adalah **RLS di Supabase**, bukan kerahasiaan key ini.
- File `.env` **tidak ikut ke GitHub** (sudah ada di `.gitignore`); pakai
  `.env.example` sebagai panduan untuk di komputer lokal.
- Alternatif tanpa Git: `npm run build` lalu tarik folder `dist` ke
  <https://app.netlify.com/drop> (isi environment variable tetap perlu diatur di dashboard).

> ⚠️ **Keamanan:** pada `supabase/schema.sql`, RLS dibuat permisif karena aplikasi
> belum memakai Supabase Auth. Artinya siapa pun yang tahu URL situs + anon key
> dapat membaca/menulis data siswa langsung lewat API. Sebelum situs dibagikan
> luas, aktifkan Supabase Auth lalu perketat policy RLS.

### Alternatif hosting

Repo ini juga siap untuk **Vercel** (`vercel.json`) dan **Cloudflare Pages**
(memakai `public/_redirects`) tanpa perubahan kode.

## Akun bawaan

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@assalam.sch.id` | `default123` |
| Tata Usaha | `yunitaeka124@gmail.com` | `default123` |

Pengguna akan diminta mengganti password saat login pertama. Jika lupa password
atau akun terkunci karena 3 kali salah, buka **Admin Panel → Pengguna → Reset**.

## Struktur

```
src/
├─ components/      # UI bersama (tabel, modal, sidebar, dst.) + admin/ dan ekskul/
├─ context/         # AuthContext (sesi & hak akses), DataContext (reaktivitas data)
├─ hooks/           # useStudents, usePayments, useEkskul, ...
├─ lib/             # db.js (local-first + sinkronisasi Supabase), supabase.js, toast.js
├─ services/settingsService.js  # tarif SPP & biaya ekskul (tersimpan di db.meta.settings)
├─ pages/           # halaman per fitur
├─ services/        # lapisan data: student, payment, ekskul, auth
└─ utils/           # paymentCalculator, currency, helpers
supabase/schema.sql # skema tabel + policy RLS
```

## Catatan keamanan

Aplikasi memakai `anon key` dari browser tanpa Supabase Auth, sehingga policy RLS
pada `schema.sql` dibuat permisif (setara penyimpanan lokal, namun terpusat).
Sebelum dipublikasikan ke internet, ganti policy tersebut dengan aturan berbasis
Supabase Auth.

---

© SDIT As-Salam Islamic Green School — Wira | Eka, All Rights Reserved.
