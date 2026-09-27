-- =====================================================================
--  System TU Management — SDIT As-Salam Islamic Green School
--  Skema database Supabase (PostgreSQL)
--
--  CARA PAKAI
--  1. Buka Supabase Dashboard → project "System TU Management".
--  2. Masuk ke menu SQL Editor → New query.
--  3. Tempel SELURUH isi file ini lalu klik RUN.
--  4. Skema aman dijalankan berulang kali (idempotent).
--
--  CATATAN KEAMANAN
--  Aplikasi ini memakai anon key dari browser tanpa Supabase Auth.
--  Karena itu RLS diaktifkan dengan policy permisif (setara dengan
--  penyimpanan lokal sebelumnya, namun terpusat). Jika nanti aplikasi
--  dipublikasikan ke internet, ganti policy berikut dengan aturan
--  berbasis Supabase Auth.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tahun ajaran
-- ---------------------------------------------------------------------
create table if not exists public.academic_years (
  id text primary key,
  nama_tahun_ajaran text not null,
  tahun_mulai integer,
  tahun_selesai integer,
  status text default 'aktif',
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- Buku Induk (master data siswa)
-- Kolom bersarang (father/mother/guardian/address) disimpan sebagai jsonb.
-- ---------------------------------------------------------------------
create table if not exists public.students (
  id text primary key,
  no_urut integer,
  rombel text,
  kelas text,
  no_induk text unique,
  nisn text,
  nama_lengkap text not null,
  nama_panggilan text,
  no_kk text,
  nik text,
  no_regis_akta text,
  jenis_kelamin text,
  agama text,
  kewarganegaraan text,
  tempat_tanggal_lahir text,
  anak_ke integer,
  jumlah_saudara integer,
  bahasa_sehari_hari text,
  alamat text,
  nomor_hp text,
  tinggal_bersama text,
  jarak_tempat_tinggal text,
  waktu_tempuh text,
  pendidikan_sebelumnya text,
  tinggi_badan numeric,
  berat_badan numeric,
  lingkar_kepala numeric,
  keterangan text,
  father jsonb,
  mother jsonb,
  guardian jsonb,
  address jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists students_kelas_idx on public.students (kelas);
create index if not exists students_no_induk_idx on public.students (no_induk);
create index if not exists students_nama_idx on public.students (nama_lengkap);

-- ---------------------------------------------------------------------
-- Pengguna aplikasi & hak akses
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id text primary key,
  email text unique not null,
  name text not null,
  role text not null default 'tu',
  -- Dipakai hanya saat aplikasi berjalan tanpa Supabase (mode lokal).
  -- Bila login memakai Supabase Auth, password_hash dikosongkan.
  password_hash text not null default '',
  must_change_password boolean default true,
  is_active boolean default true,
  permission_overrides jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  -- Penghubung ke akun login Supabase Auth (auth.users.id) + asal login
  -- ('email' = password, 'azure' = Microsoft/Entra ID).
  auth_user_id uuid unique,
  auth_provider text default 'email'
);

-- Untuk database yang sudah ada sebelumnya (idempotent).
alter table public.users add column if not exists auth_user_id uuid unique;
alter table public.users add column if not exists auth_provider text default 'email';
alter table public.payments add column if not exists jenis text not null default 'spp';

-- ---------------------------------------------------------------------
-- Pembayaran SPP bulanan (join ke students)
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id text primary key,
  student_id text references public.students (id) on delete cascade,
  bulan text not null,
  tahun integer,
  -- 'spp' = tagihan bulanan, 'lain' = pembayaran lain-lain (tidak mengurangi SPP).
  jenis text not null default 'spp',
  academic_year_id text,
  nominal_bayar numeric not null default 0,
  tanggal_bayar date,
  keterangan text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create index if not exists payments_student_idx on public.payments (student_id);
create index if not exists payments_bulan_idx on public.payments (bulan);

-- ---------------------------------------------------------------------
-- Ekskul siswa (Ekskul saat ini)
-- ---------------------------------------------------------------------
create table if not exists public.student_ekskul (
  id text primary key,
  student_id text references public.students (id) on delete cascade,
  ekskul_nama text not null,
  biaya_bulanan numeric not null default 0,
  tahun_ajaran text,
  status text default 'aktif',
  created_at timestamptz default now(),
  updated_at timestamptz
);

create index if not exists student_ekskul_student_idx on public.student_ekskul (student_id);

-- ---------------------------------------------------------------------
-- Pembayaran ekskul (per periode bulan)
-- ---------------------------------------------------------------------
create table if not exists public.ekskul_payments (
  id text primary key,
  student_ekskul_id text,
  student_id text references public.students (id) on delete cascade,
  ekskul_nama text,
  bulan text not null,
  tahun integer,
  nominal_bayar numeric not null default 0,
  tanggal_bayar date,
  keterangan text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create index if not exists ekskul_payments_student_idx on public.ekskul_payments (student_id);

-- ---------------------------------------------------------------------
-- Adjustment / potongan tagihan SPP
-- Pembayaran yang sudah tercatat di pembukuan sebelumnya (di luar aplikasi).
-- Nominalnya dihitung sebagai sudah dibayar, sedangkan bulan yang dicentang
-- (`bulan`) langsung dianggap lunas pada peta pembayaran bulanan.
-- ---------------------------------------------------------------------
create table if not exists public.payment_adjustments (
  id text primary key,
  student_id text references public.students (id) on delete cascade,
  -- Tahun MULAI periode tahun ajaran (Juli–Juni), mis. 2025 = "Juli 2025–Juni 2026".
  tahun integer,
  nominal numeric not null default 0,
  -- Daftar nama bulan yang dicentang, mis. ["Juli","Agustus"].
  bulan jsonb not null default '[]'::jsonb,
  keterangan text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create index if not exists payment_adjustments_student_idx
  on public.payment_adjustments (student_id);

-- ---------------------------------------------------------------------
-- Meta aplikasi (counter, jejak import, dll.)
-- ---------------------------------------------------------------------
create table if not exists public.app_meta (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- Row Level Security + policy permisif (tanpa Supabase Auth)
-- ---------------------------------------------------------------------
alter table public.academic_years enable row level security;
alter table public.students enable row level security;
alter table public.users enable row level security;
alter table public.payments enable row level security;
alter table public.student_ekskul enable row level security;
alter table public.ekskul_payments enable row level security;
alter table public.payment_adjustments enable row level security;
alter table public.app_meta enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'academic_years', 'students', 'users', 'payments',
    'student_ekskul', 'ekskul_payments', 'payment_adjustments', 'app_meta'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_full_access', t);
    execute format(
      'create policy %I on public.%I for all using (true) with check (true)',
      t || '_full_access', t
    );
  end loop;
end $$;
