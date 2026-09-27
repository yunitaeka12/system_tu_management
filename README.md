# System TU Management — SDIT As-Salam Islamic Green School

Sistem Informasi Tata Usaha: Buku Induk siswa, pembayaran SPP bulanan, ekskul,
dan panel administrator. Dibangun dengan React + Vite, data tersimpan di
**Supabase** (PostgreSQL) dengan penyimpanan lokal sebagai cadangan.

## Fitur

| Modul | Isi |
| --- | --- |
| **Dashboard** | Ringkasan tagihan, pembayaran, piutang, **jumlah siswa Mutasi**, chart per bulan, insight per kelas |
| **Buku Induk** | Master data 1.200+ siswa, pencarian, filter kelas/rombel/tahun ajaran/**status**, import & export Excel, status siswa **Aktif/Mutasi**, serta kelola ekskul siswa + riwayat pembayarannya per tanggal |
| **Pembayaran** | Pencatatan SPP per bulan — sekaligus bisa memilih ekskul & mencatat bayar ekskul (opsional) dan **Pembayaran Lain** (nominal + keterangan, bisa lebih dari satu baris), peta warna bulanan gabungan SPP+ekskul (merah/kuning/hijau) dengan **filter periode tahun ajaran (Juli–Juni)** dan keterangan tunggakan per periode, kolom **SPP Terakhir**, **Adjustment** untuk pembayaran yang sudah tercatat di pembukuan sebelumnya, riwayat gabungan + pagination |
| **Report Pembayaran** | Rekap seluruh siswa: total tagihan, sudah dibayar, sisa tagihan, tunggakan per periode tahun ajaran, plus riwayat bayar tiap siswa; filter tahun ajaran/kelas/status dengan pilihan tampil semua data atau per halaman, dan **Export Excel** (sheet rekap + riwayat) |
| **Pengaturan** | Ubah tarif SPP per angkatan dan biaya tiap ekskul (plus tambah/hapus angkatan & ekskul) |
| **Admin Panel** | Kelola pengguna (termasuk role **Guru**), hak akses menu dan tindakan per role/pengguna, pengaturan kewajiban authenticator per pengguna (**Administrator selalu wajib**), **Bulk Adjust** (tandai bulan/periode yang sudah dibayar di pembukuan lama untuk satu angkatan/kelas sekaligus), hapus massal per kelas/tahun ajaran (tema gelap) |
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
   `yunitaeka124@gmail.com`) supaya role & hak aksesnya ketemu. Centang **Auto
   Confirm User**. Kolom `auth_user_id` terisi otomatis saat login pertama
   berhasil.

   > **Baris di tabel `users` tidak sama dengan akun login.** Baris di tabel
   > `users` (role & hak akses) dibuat otomatis oleh aplikasi lewat `SEED_USERS`
   > dan Admin Panel, sedangkan akun di **Authentication → Users** (password +
   > authenticator) dibuat tersendiri. Sejak ada Edge Function `admin-users`
   > (lihat [1d](#1d-buat-akun-login-otomatis-dari-admin-panel-edge-function)),
   > menambah pengguna di Admin Panel **otomatis membuatkan akun login-nya**.
   > Tanpa fungsi itu, akun tetap dibuat manual di **Authentication → Users**.
   > Kunci `service_role` tidak pernah dipakai di browser — hanya di fungsi server.
   >
   > Gejala bila salah satu belum dibuat:
   >
   > - Ada di `users` tapi belum ada di Authentication → login gagal dengan
   >   *"Invalid login credentials"*.
   > - Ada di Authentication tapi belum ada di `users` → login berhasil tetapi
   >   muncul *"Akun login ini belum terdaftar di aplikasi."*
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
6. Di **Admin Panel → Pengguna**, Administrator dapat mengatur **Wajibkan authenticator**
   untuk setiap akun non-Administrator. Jika dimatikan, akun tersebut bisa login
   dengan email + password tanpa kode; faktor TOTP yang sudah terdaftar **tetap
   disimpan** dan dapat dipakai lagi jika diwajibkan kembali. Akun baru secara
   default tetap diwajibkan memakai authenticator. Akun Administrator tidak bisa
   dikecualikan dan selalu tetap wajib authenticator.
7. Role **Guru** tersedia dengan hak akses bawaan yang sama seperti Tata Usaha;
   Administrator dapat menyempitkan akses Guru di tab **Hak Akses**.
8. Batas 3x salah password / salah kode tetap berlaku (penghitung di browser).
   Langkah 2 yang belum selesai batal sendiri setelah 15 menit.
9. **Lupa HP / HP hilang**: Administrator menghapus faktor TOTP akun tersebut
   dari **Supabase → Authentication → Users → (pilih user) → Factor**, lalu
   pengguna mendaftarkan authenticator baru saat login berikutnya.

> Pengaturan “Wajibkan authenticator” melewati langkah TOTP di alur aplikasi
> saja—tidak menghapus faktor dan tidak menonaktifkan MFA secara global di
> Supabase. Jika RLS Anda mewajibkan JWT `aal2`, akun yang MFA-nya dimatikan
> tetap tidak bisa mengakses kebijakan tersebut dengan sesi `aal1`; sesuaikan
> kebijakan hanya setelah menimbang dampak keamanannya.

Untuk database yang sudah ada, jalankan ulang `supabase/schema.sql` agar kolom
`users.require_authenticator` ditambahkan (perintahnya idempotent).

> Alur password (popup “ganti password”, konfirmasi tiap 3 jam) tetap berlaku
> karena semua pengguna login dengan password. Login Google/Microsoft juga masih
> tersedia di kode (`loginWithSso()`), tinggal diaktifkan provider-nya.

> ⚠️ RLS pada `supabase/schema.sql` masih **permisif**, jadi anon key tetap bisa
> dipakai membaca data langsung lewat API. Setelah login pindah ke Supabase Auth,
> perketat policy-nya (mis. `using ((auth.jwt() ->> 'aal') = 'aal2')` untuk MFA).

### 1d. Buat akun login otomatis dari Admin Panel (Edge Function)

Supabase hanya mengizinkan pembuatan akun Auth lewat **`service_role` key**, dan
kunci itu tidak boleh ditaruh di bundle browser. Karena itu logika pembuatannya
dipindah ke satu **Edge Function** (`supabase/functions/admin-users`) yang
berjalan di server Supabase. **Login tetap memakai Supabase Auth persis seperti
sebelumnya** (email + password, lalu kode authenticator/TOTP) — fungsi ini hanya
membuat/menghapus/mengubah password akun, bukan menggantikan autentikasinya.

Saat fungsi ini aktif, dari **Admin Panel → Pengguna**:

- **Tambah Pengguna** → akun Supabase Auth dibuat otomatis memakai password yang
  diisi (email langsung terkonfirmasi).
- **Reset Password** → password akun Supabase Auth ikut diubah, penghitung salah
  password dibuka. Bila baris pengguna itu belum punya akun Auth (mis. dibuat
  sebelum fungsi ini di-deploy), akunnya **dibuat sekaligus** — jadi tombol ini
  juga merapikan akun yang tertinggal.
- **Hapus Pengguna** → akun Supabase Auth ikut dihapus.

Deploy sekali saja:

```bash
npx supabase login
npx supabase link --project-ref <project-ref-anda>
npx supabase functions deploy admin-users
```

`SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` otomatis tersedia di dalam Edge
Function, jadi tidak perlu mengatur secret mana pun. Fungsi memverifikasi bahwa
pemanggilnya benar-benar **Administrator** (dicek dari tabel `users`) sebelum
melakukan aksi.

Bila fungsi belum di-deploy, aplikasi tetap berjalan: baris pengguna dibuat,
tetapi akun login harus ditambahkan manual di **Authentication → Users**. Admin
Panel menampilkan **banner peringatan “Akun login otomatis belum aktif”** beserta
perintah deploy-nya (tombol **Cek lagi** untuk memeriksa ulang setelah deploy) —
sebelumnya kegagalan ini hanya berupa toast singkat sehingga mudah terlewat.

Cara memeriksa cepat dari terminal apakah fungsinya sudah jalan:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "$VITE_SUPABASE_URL/functions/v1/admin-users" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" -d '{"action":"status"}'
```

`404` / `NOT_FOUND` = belum di-deploy; `401` / `403` = sudah ada (menolak karena
bukan sesi Administrator).

### 1e. Adjustment — pembayaran yang sudah tercatat di pembukuan sebelumnya

Di halaman **Detail Pembayaran** ada tombol **Adjustment** (butuh hak akses
“Ubah pembayaran”). Fungsinya mencatat pembayaran yang **sudah masuk dan
tercatat di pembukuan sebelumnya** (di luar aplikasi), misalnya data pindahan
dari buku besar lama.

Isi formulirnya:

- **Total Adjustment** — nominal yang sudah dibayar, mis. `2.000.000`.
- **Keterangan** — otomatis terisi *“Sudah bayar dan tercatat di pembukuan
  sebelumnya”*, tetap bisa diubah.
- **Bulan yang dicentang** — bulan-bulan yang sudah dibayar dengan nominal itu.
- **Periode Tahun Ajaran** — menentukan periode peta bulanan mana yang berubah
  (mis. “Juli 2025 – Juni 2026”).

### 1e.1 Bulk Adjust — adjustment massal dari Admin Panel

Tab **Bulk Adjust** di Admin Panel menandai bulan yang **sudah dibayar di
pembukuan sebelumnya** untuk banyak siswa sekaligus:

1. Pilih **Tahun Ajaran** (angkatan, dari 4 digit awal No Induk) dan/atau
   **Kelas** — minimal salah satu.
2. Pilih **Periode** tahun ajaran (mis. *Juli 2025 – Juni 2026*) dan centang
   **bulan** yang sudah dibayar (bisa “Pilih semua”).
3. Panel **Perkiraan Dampak** menampilkan jumlah siswa terdampak dan total
   tagihan yang berkurang sebelum diterapkan.

Nominal dihitung otomatis: **jumlah bulan × tarif SPP angkatan siswa**, jadi
tagihan setiap siswa pada periode tersebut langsung berkurang. Adjustment yang
sudah ada pada periode yang sama akan **digabung** (bulan disatukan, nominal
dihitung ulang) sehingga aman dijalankan berulang.

### 1e.2 Pembayaran Lain (di luar SPP)

Di form **Pembayaran** ada tombol **+ Pembayaran Lain** yang memunculkan dua
kolom: **Nominal** dan **Keterangan Pembayaran** (mis. “Seragam olahraga”).
Tombol ini **tetap tampil di bawah baris** yang sudah ada, sehingga dalam satu
kali simpan bisa dicatat **lebih dari satu** pembayaran lain (tiap baris punya
tombol **Hapus** sendiri dan disimpan sebagai transaksi terpisah).
Pembayaran ini:

- **tidak mengurangi tagihan SPP** (tidak mempengaruhi sisa tagihan maupun
  status lunas),
- tetap tercatat di **peta bulanan** (baris keterangannya muncul pada bulan
  transaksi) dan di **riwayat transaksi** dengan badge *Pembayaran Lain*,
- disimpan di tabel `payments` dengan kolom **`jenis = 'lain'`**.

Efeknya:

- **Sisa tagihan berkurang** sebesar nominal adjustment (dihitung sebagai sudah
  dibayar — “Total Dibayar” dan dashboard ikut menyesuaikan, dengan catatan
  `termasuk adjustment Rp …`).
- **Bulan yang dicentang langsung hijau (lunas)** pada Peta Bulanan, tanpa
  transaksi baru — termasuk ekskul bulan itu, karena dianggap sudah selesai di
  pembukuan lama.
- Pada riwayat muncul satu baris ber-badge **Adjustment**, dan keterangannya
  tampil di kartu **Adjustment Tagihan** pada halaman detail.
- Kolom **SPP Terakhir** di tabel Pembayaran ikut menampilkan `(adjustment)`
  bila bulan terakhirnya lunas karena adjustment.

Data disimpan di tabel `payment_adjustments`, dan penanda pembayaran lain-lain
memakai kolom baru `payments.jenis`. Keduanya **baru** — jalankan ulang
[`supabase/schema.sql`](supabase/schema.sql) di **SQL Editor** (aman dijalankan
berulang) agar tabel & kolomnya dibuat di Supabase. Tanpa itu fitur tetap bisa
dicoba di penyimpanan lokal, tetapi hasilnya gagal terkirim ke Supabase.

### 1g. Report Pembayaran

Menu **Report Pembayaran** (sidebar, butuh hak akses “Lihat pembayaran”)
menampilkan satu baris per siswa dengan kolom: No Induk, NISN, nama, kelas,
tahun ajaran (angkatan), total tagihan, sudah dibayar, sisa tagihan, dan status.

- Filter **Tahun Ajaran** (angkatan), **Kelas**, **Status**, dan pencarian nama
  / No Induk / NISN.
- Pilihan tampilan: **10/25/50/100 data per halaman** atau **Semua data**.
- Klik ikon panah pada baris untuk melihat **Tagihan per Periode Tahun Ajaran**
  (berapa yang sudah dibayar, berapa bulan & nominal tunggakannya) dan
  **History Bayar** siswa tersebut (SPP, ekskul, pembayaran lain, adjustment).
- Tombol **Export Excel** mengunduh dua sheet: *Rekap Pembayaran* (termasuk
  kolom “Tunggakan per Periode” dan “Bulan Tunggakan”) dan *Riwayat Pembayaran*.

### 1h. Status siswa: Aktif / Mutasi

Setiap siswa di Buku Induk punya **Status Siswa** yang bisa diubah lewat form
Tambah/Edit Siswa (field **Status Siswa**):

- **Aktif** (bawaan) — dihitung normal dalam seluruh tagihan & laporan.
- **Mutasi** — siswa pindah/keluar, sehingga **dikecualikan dari semua
  perhitungan keuangan**: tidak masuk total tagihan sekolah, dashboard, grafik
  penerimaan, insight per kelas, piutang terbesar, tabel Pembayaran, maupun
  Report Pembayaran. Datanya tetap tersimpan di Buku Induk (ditandai badge
  *Mutasi*) agar riwayat tidak hilang.

Dashboard menampilkan card **Siswa Mutasi** berisi jumlah siswa berstatus
mutasi. Filter **Status Siswa** juga tersedia di toolbar Buku Induk.

### 1i. Filter yang diingat antar-halaman

Pencarian, filter (tahun ajaran/kelas/rombel/jenis kelamin/status), jumlah baris
per halaman, urutan kolom, dan posisi halaman pada **Pembayaran**, **Buku
Induk**, serta **Report Pembayaran** disimpan selama sesi tab
(`sessionStorage`). Jadi setelah membuka **detail siswa** lalu menekan
**Kembali** (atau memuat ulang halaman), daftar tetap tampil dengan filter yang
sama. Tekan **Reset** untuk mengembalikannya ke default.

Filter tersimpan ini **otomatis dihapus saat logout** (juga saat sesi berakhir /
kadaluarsa), sehingga pengguna berikutnya di perangkat yang sama selalu mulai
dari tampilan default.

Kolom baru `students.status_siswa` (`'aktif'` | `'mutasi'`, idempotent) —
jalankan ulang [`supabase/schema.sql`](supabase/schema.sql) di **SQL Editor**
agar kolomnya tersedia di Supabase.

### 1f. Periode tahun ajaran (Juli–Juni) pada Peta Bulanan

Peta Bulanan dan riwayat pembayaran **tidak lagi memakai tahun kalender**,
melainkan **periode tahun ajaran Juli–Juni** yang diturunkan dari No Induk
(4 digit awal), mis. `25261001` → **Juli 2025 – Juni 2026**.

- Dropdown periode memuat periode No Induk sampai **periode berjalan** — pada
  September 2026 siswa No Induk `2526` mendapat dua pilihan:
  *Juli 2026 – Juni 2027* (periode berjalan, dipilih otomatis) dan
  *Juli 2025 – Juni 2026*.
- Nama bulan di peta ikut menyesuaikan tahunnya: *Juli 2025, Agustus 2025, …,
  Juni 2026*, dan aliran kelebihan bayar dihitung urut Juli → Juni.
- Transaksi disaring per periode (bulan + tahun), jadi pembayaran Juli 2025 dan
  Juli 2026 tidak saling bercampur. Hal yang sama berlaku untuk pembayaran
  ekskul dan adjustment.
- Kartu **Total Tagihan/Sudah Dibayar/Sisa Tagihan/Status** menghitung tagihan
  periode berjalan, dengan keterangan periode pada kartunya.
- **Tagihan menumpuk semua periode**: sejak periode No Induk sampai periode
  berjalan. Siswa No Induk `2526` pada 2026/2027 ditagih untuk periode
  2025/2026 **dan** 2026/2027 (2 × Rp 3.240.000); periode lama yang belum
  dibayar ikut terhitung sebagai tunggakan — itulah yang dituntaskan lewat
  **Bulk Adjust** / Adjustment saat datanya memang sudah dibayar di buku lama.
- Kartu **Total Tagihan/Sudah Dibayar/Sisa Tagihan/Status** menampilkan jumlah
  periode yang dihitung; kartu **Sisa Tagihan** menyebut rentang periodenya dan
  jumlah bulan + nominal tunggakan.
- Panel **Tagihan per Periode** menampilkan satu baris per periode tahun ajaran
  (mis. *Periode Juli 2025 – Juni 2026 → 12 bulan • Rp 3.240.000*, *Periode
  Juli 2026 – Juni 2027 → 11 bulan • Rp 2.965.000*) beserta status lunas /
  belum lunas — tanpa daftar per bulan yang panjang.
- Pembayaran “lain-lain” tidak ikut mengurangi SPP, hanya menambah info
  pembayaran lain pada kartu & report.
- Form pembayaran & adjustment memakai bulan berlabel tahun, dan tahun yang
  disimpan mengikuti periode tersebut (Januari–Juni masuk tahun berikutnya).

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

Baris berikut dibuat **otomatis** oleh aplikasi di tabel `users` (role & hak
akses) saat aplikasi pertama dibuka:

| Role | Email |
| --- | --- |
| Administrator | `admin@assalam.sch.id` |
| Tata Usaha | `yunitaeka124@gmail.com` |

Kolom password tidak dicantumkan karena bergantung pada mode login:

- **Mode lokal** (env var Supabase kosong): password awal `default123`.
- **Supabase Auth**: baris di atas **bukan akun login** — passwordnya belum ada.
  Buat akunnya lebih dulu di **Supabase → Authentication → Users → Add user**
  dengan email yang sama persis, lalu login dua langkah (password + TOTP).

Pengguna akan diminta mengganti password saat login pertama. Jika lupa password
atau akun terkunci karena 3 kali salah, buka **Admin Panel → Pengguna → Reset**
(mode lokal) atau **Supabase → Authentication → Users** (Supabase Auth).

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
