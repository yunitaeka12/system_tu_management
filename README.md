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

### 1b. Login memakai Supabase Auth (disarankan)

Bila `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` terisi, aplikasi otomatis
memakai **Supabase Auth** untuk memverifikasi password (hash ditangani server).
Kalau env var kosong, login kembali ke **mode lokal** (hash SHA-256 di browser).

1. Tambahkan kolom penghubung ke akun login — jalankan di **SQL Editor**:

   ```sql
   alter table public.users add column if not exists auth_user_id uuid unique;
   alter table public.users add column if not exists auth_provider text default 'email';
   ```

2. **Authentication → Providers → Email**: aktifkan.
3. **Authentication → Settings**: matikan **Confirm email** (akun dibuat oleh
   Administrator, bukan pendaftaran sendiri) dan set minimal password 8 karakter.
4. **Authentication → Users → Add user** untuk tiap pengguna. Emailnya **harus
   sama persis** dengan baris di tabel `users` (mis. `admin@assalam.sch.id`,
   `yunitaeka12@gmail.com`) supaya role & hak aksesnya ketemu. Kolom
   `auth_user_id` terisi otomatis saat login pertama berhasil.
5. Menambah user baru: buat dulu di **Admin Panel** (nama, email, role), lalu
   buat akun login-nya di Supabase dengan email yang sama.
6. Reset/lupa password: dari **Supabase → Authentication → Users**, bukan lewat
   Admin Panel. Tombol *Reset Password* di Admin Panel hanya membuka kembali
   akses yang terkunci 3x salah password.
7. Ganti password dari aplikasi memakai `supabase.auth.updateUser`, sehingga
   hash lokal tidak dipakai lagi (`password_hash` dikosongkan). Email login juga
   tidak bisa diubah dari Profil — ubah di dashboard Supabase.

Sesi login divalidasi ulang dengan sesi Supabase saat aplikasi dibuka: bila sesi
Supabase sudah tidak ada (logout di tab lain / token kadaluarsa), pengguna
otomatis diarahkan ke halaman login.

### 1c. Login dua langkah: password + kode authenticator (TOTP)

Setelah kedua env var Supabase terisi, login berjalan dua langkah: **(1) email +
password**, lalu **(2) kode 6 angka dari aplikasi authenticator**. Tidak butuh
domain, SMTP, atau layanan email. Kalau env var Supabase kosong, login kembali
satu langkah (mode lokal).

1. **Supabase → Authentication → Sign In / Providers → Email**: aktifkan
   **Email provider**. `Confirm email` boleh OFF (akun dibuat Administrator).
2. **Supabase → Authentication → Multi-Factor**: biarkan **TOTP** aktif
   (bawaan). Phone MFA tidak dipakai karena berbayar lewat Twilio.
3. **User**: buat akun di **Authentication → Users** dengan email yang sama
   seperti baris di tabel `users` (Admin Panel) beserta password. Aplikasi
   memakai `shouldCreateUser: false`, jadi orang luar tidak bisa mendaftar.
4. **Pendaftaran authenticator**: saat login pertama, setelah password benar
   aplikasi menampilkan QR — pindai dengan Google Authenticator/Authy/Microsoft
   Authenticator (ada juga kode manual bila QR tidak bisa dipindai), lalu
   masukkan 6 angka untuk mengaktifkan.
5. **Login berikutnya**: password → kode 6 angka dari aplikasi tersebut. Sesi
   Supabase naik ke **aal2** setelah kode benar, dan aplikasi menolak memulihkan
   sesi selama kode belum diverifikasi (anti-bypass refresh).
6. Batas 3x salah password / salah kode tetap berlaku (penghitung di browser).
   Langkah 2 yang belum selesai batal sendiri setelah 15 menit.
7. **Lupa HP / HP hilang**: Administrator menghapus faktor TOTP akun tersebut
   dari **Supabase → Authentication → Users → (pilih user) → Factor**, lalu
   pengguna mendaftarkan authenticator baru saat login berikutnya.

> Alur password (popup “ganti password”, konfirmasi tiap 3 jam) tetap berlaku
> karena semua pengguna login dengan password. Login Google/Microsoft juga masih
> tersedia di kode (`loginWithSso()`), tinggal diaktifkan provider-nya.

> ⚠️ RLS pada `supabase/schema.sql` masih **permisif**, jadi anon key tetap bisa
> dipakai membaca data langsung lewat API. Setelah login pindah ke Supabase Auth,
> perketat policy-nya (mis. `using ((auth.jwt() ->> 'aal') = 'aal2')` untuk MFA).

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
