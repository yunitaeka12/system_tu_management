/**
 * Service autentikasi.
 *
 * Password disimpan sebagai hash SHA-256 + salt (tidak pernah plain text).
 * Struktur role sengaja dibuat array agar mudah ditambah
 * (administrator, tu, kepala_sekolah, bendahara).
 */
import { getDB, commit, hashPassword, verifyPassword } from '../lib/db';
import { uid } from '../utils/helpers';
import { supabase, isSupabaseAuthEnabled } from '../lib/supabase';

const SESSION_KEY = 'assalam.tu.session';

/** Edge Function yang menangani akun login Supabase (memakai service_role). */
const ADMIN_USERS_FUNCTION = 'admin-users';

/**
 * Panggil Edge Function `admin-users` untuk membuat/menghapus/mengubah password
 * akun login Supabase Auth. `unavailable` true bila Supabase belum dikonfigurasi
 * atau fungsinya belum di-deploy, sehingga pemanggil bisa memakai jalur manual
 * (buat akun lewat dashboard Supabase).
 */
async function callAdminUsers(payload) {
  if (!isSupabaseAuthEnabled) return { ok: false, unavailable: true };
  try {
    const { data, error } = await supabase.functions.invoke(ADMIN_USERS_FUNCTION, {
      body: payload,
    });
    if (error) {
      let message = error.message || 'Gagal memanggil layanan admin.';
      let status;
      try {
        status = error.context?.status;
        const body = await error.context?.json?.();
        if (body?.error) message = body.error;
      } catch {
        /* biarkan pesan bawaan */
      }
      return {
        ok: false,
        unavailable: status === 404 || /not found|failed to (send|fetch)/i.test(message),
        error: message,
      };
    }
    if (!data?.ok) return { ok: false, error: data?.error || 'Aksi admin gagal diproses.' };
    return {
      ok: true,
      auth_user_id: data.auth_user_id ?? null,
      skipped: data.skipped,
      created: data.created,
    };
  } catch (error) {
    return { ok: false, unavailable: true, error: error?.message };
  }
}
/**
 * Cek kesiapan layanan akun login otomatis (Edge Function `admin-users`).
 * Dipakai indikator di Admin Panel supaya kegagalan tidak terlihat seperti sukses.
 */
export async function checkAdminService() {
  if (!isSupabaseAuthEnabled) {
    return { available: false, error: 'Supabase belum dikonfigurasi (VITE_SUPABASE_URL kosong).' };
  }
  const result = await callAdminUsers({ action: 'status' });
  if (result.ok) return { available: true };
  return { available: false, error: result.error };
}


export const ROLES = {
  ADMINISTRATOR: 'administrator',
  TU: 'tu',
  KEPALA_SEKOLAH: 'kepala_sekolah',
  BENDAHARA: 'bendahara',
};

export const ROLE_LABELS = {
  administrator: 'Administrator',
  tu: 'Tata Usaha',
  kepala_sekolah: 'Kepala Sekolah',
  bendahara: 'Bendahara',
};

export const ROLE_KEYS = Object.keys(ROLE_LABELS);

/** Hak akses bawaan per role (masih bisa diubah dari Admin Panel). */
export const DEFAULT_PERMISSIONS = {
  administrator: [
    'student.view',
    'student.create',
    'student.update',
    'student.delete',
    'student.import',
    'payment.view',
    'payment.create',
    'payment.update',
    'payment.delete',
    'user.manage',
    'settings.manage',
  ],
  tu: [
    'student.view',
    'student.create',
    'student.update',
    'student.import',
    'payment.view',
    'payment.create',
    'payment.update',
    'payment.delete',
  ],
  bendahara: ['student.view', 'payment.view', 'payment.create', 'payment.update'],
  kepala_sekolah: ['student.view', 'payment.view'],
};

/** Daftar seluruh permission yang dikenal sistem. */
export const ALL_PERMISSIONS = [
  { key: 'student.view', label: 'Lihat Buku Induk', group: 'Buku Induk' },
  { key: 'student.create', label: 'Tambah siswa', group: 'Buku Induk' },
  { key: 'student.update', label: 'Ubah data siswa', group: 'Buku Induk' },
  { key: 'student.delete', label: 'Hapus data siswa', group: 'Buku Induk' },
  { key: 'student.import', label: 'Import Excel', group: 'Buku Induk' },
  { key: 'payment.view', label: 'Lihat pembayaran', group: 'Keuangan' },
  { key: 'payment.create', label: 'Catat pembayaran', group: 'Keuangan' },
  { key: 'payment.update', label: 'Ubah pembayaran', group: 'Keuangan' },
  { key: 'payment.delete', label: 'Hapus pembayaran', group: 'Keuangan' },
  { key: 'user.manage', label: 'Kelola pengguna & hak akses', group: 'Administrasi' },
  { key: 'settings.manage', label: 'Ubah pengaturan tarif', group: 'Administrasi' },
];

/**
 * Hak akses efektif sebuah role. Nilai tersimpan di database (dapat diubah
 * Administrator); bila belum pernah diubah, memakai default di atas.
 */
export function getRolePermissions(role) {
  const stored = getDB().role_permissions?.[role];
  if (Array.isArray(stored)) return stored;
  return DEFAULT_PERMISSIONS[role] || [];
}

/** Seluruh matriks hak akses yang berlaku saat ini. */
export function getPermissionMatrix() {
  return Object.fromEntries(ROLE_KEYS.map((role) => [role, getRolePermissions(role)]));
}

/** Aktif/nonaktifkan satu permission untuk sebuah role. */
export function setRolePermission(role, permission, enabled) {
  if (role === ROLES.ADMINISTRATOR) {
    return { ok: false, error: 'Hak akses Administrator selalu penuh dan tidak dapat dikurangi.' };
  }
  const current = getRolePermissions(role);
  const next = enabled
    ? [...new Set([...current, permission])]
    : current.filter((item) => item !== permission);

  commit((draft) => {
    draft.role_permissions = { ...(draft.role_permissions || {}), [role]: next };
  });
  return { ok: true, permissions: next };
}

/** Kembalikan matriks hak akses ke bawaan. */
export function resetRolePermissions() {
  commit((draft) => {
    draft.role_permissions = {};
  });
  return { ok: true };
}

export function can(user, permission) {
  if (!user) return false;

  const record = (getDB().users || []).find((item) => item.id === user.user_id);
  if (record && record.is_active === false) return false;

  // Administrator selalu memiliki akses penuh agar tidak bisa terkunci sendiri.
  if (user.role === ROLES.ADMINISTRATOR) return true;

  const overrides = record?.permission_overrides;
  if (overrides && typeof overrides[permission] === 'boolean') return overrides[permission];

  return getRolePermissions(user.role).includes(permission);
}

/** Atur override hak akses khusus satu pengguna (null = ikut role). */
export function setUserPermissionOverride(userId, permission, value) {
  commit((draft) => {
    const target = (draft.users || []).find((item) => item.id === userId);
    if (!target) return;
    const overrides = { ...(target.permission_overrides || {}) };
    if (value === null) delete overrides[permission];
    else overrides[permission] = value;
    target.permission_overrides = Object.keys(overrides).length ? overrides : null;
    target.updated_at = new Date().toISOString();
  });
  return { ok: true };
}

export const PERMISSIONS = DEFAULT_PERMISSIONS;

export const DEFAULT_PASSWORD = 'default123';

/**
 * Akun bawaan sistem.
 * - Administrator: kelola user & hak akses (Admin Panel).
 * - Tata Usaha: akun operasional harian.
 */
export const SEED_USERS = [
  {
    // id sengaja tetap (deterministik) agar tidak bentrok email saat
    // beberapa browser/komputer menyiapkan akun bawaan yang sama.
    id: 'usr_admin_assalam',
    email: 'admin@assalam.sch.id',
    name: 'Administrator TU',
    role: ROLES.ADMINISTRATOR,
  },
  {
    id: 'usr_yunitaeka',
    email: 'yunitaeka124@gmail.com',
    name: 'Yunita Eka',
    role: ROLES.TU,
  },
];

/** Password lama yang perlu dimigrasikan ke password default baru. */
const LEGACY_PASSWORDS = ['admin123'];

/**
 * Pastikan seluruh akun bawaan tersedia (dan password lamanya dimigrasikan).
 * Dipanggil setiap aplikasi dibuka sehingga aman untuk data yang sudah ada.
 */
export async function ensureSeedUsers() {
  const db = getDB();
  const users = [...(db.users || [])];
  const created = [];
  let migrated = false;

  for (const seed of SEED_USERS) {
    const existing = users.find(
      (u) => String(u.email).toLowerCase() === seed.email.toLowerCase(),
    );

    if (!existing) {
      const user = {
        id: seed.id || uid('usr'),
        email: seed.email,
        name: seed.name,
        role: seed.role,
        must_change_password: true,
        password_hash: isSupabaseAuthEnabled ? '' : await hashPassword(DEFAULT_PASSWORD),
        created_at: new Date().toISOString(),
        last_login_at: null,
      };
      users.push(user);
      created.push(user);
      continue;
    }

    // Migrasi akun lama (mis. admin123) ke password default terbaru. Tidak perlu
    // saat login memakai Supabase Auth karena hash lokal tidak dipakai lagi.
    if (isSupabaseAuthEnabled) continue;

    for (const legacy of LEGACY_PASSWORDS) {
      // eslint-disable-next-line no-await-in-loop
      if (await verifyPassword(legacy, existing.password_hash)) {
        existing.password_hash = await hashPassword(DEFAULT_PASSWORD);
        existing.must_change_password = true;
        migrated = true;
      }
    }
  }

  // Hanya tulis ke database bila memang ada perubahan.
  if (created.length > 0 || migrated) {
    commit((draft) => {
      draft.users = users;
    });
  }

  return users;
}

/** Nama lama — dipertahankan agar pemanggil lama tetap bekerja. */
export const ensureDefaultAdmin = ensureSeedUsers;

/* ------------------------------------------------------------------ */
/* Pembatasan percobaan login (salah password 3x → hubungi Admin)       */
/* ------------------------------------------------------------------ */
const ATTEMPT_KEY = 'assalam.tu.login_attempts';
const MAX_ATTEMPTS = 3;

function readAttempts() {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPT_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeAttempts(value) {
  try {
    localStorage.setItem(ATTEMPT_KEY, JSON.stringify(value));
  } catch {
    /* diabaikan */
  }
}

/** Status penguncian sebuah email: { locked, remaining }. */
export function getLoginAttemptState(email) {
  const key = String(email || '').trim().toLowerCase();
  const entry = readAttempts()[key];
  const count = Number(entry?.count) || 0;
  return {
    attempts: count,
    maxAttempts: MAX_ATTEMPTS,
    remaining: Math.max(MAX_ATTEMPTS - count, 0),
    locked: count >= MAX_ATTEMPTS,
  };
}

function registerFailedAttempt(email) {
  const key = String(email || '').trim().toLowerCase();
  const attempts = readAttempts();
  const count = (Number(attempts[key]?.count) || 0) + 1;
  attempts[key] = { count, at: new Date().toISOString() };
  writeAttempts(attempts);
  return count;
}

/** Buka kembali akses login sebuah email (dipakai Admin Panel). */
export function resetLoginAttempts(email) {
  const key = String(email || '').trim().toLowerCase();
  const attempts = readAttempts();
  delete attempts[key];
  writeAttempts(attempts);
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* diabaikan */
  }
}

/**
 * Simpan sesi aplikasi.
 * `authMethod`: 'password' | 'otp' | 'sso' — menentukan apakah pengguna punya
 * password di aplikasi ini (mis. popup ganti password hanya untuk 'password').
 */
const METHOD_KEY_PREFIX = 'assalam.tu.auth_method.';

/** Ingat cara login terakhir pengguna (dipakai saat sesi dipulihkan). */
function rememberAuthMethod(userId, method) {
  try {
    localStorage.setItem(`${METHOD_KEY_PREFIX}${userId}`, method);
  } catch {
    /* diabaikan */
  }
}

function readAuthMethod(userId) {
  try {
    return localStorage.getItem(`${METHOD_KEY_PREFIX}${userId}`) || null;
  } catch {
    return null;
  }
}

function saveSession(user, authMethod = 'password') {
  rememberAuthMethod(user.id, authMethod);
  const session = {
    user_id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    auth_user_id: user.auth_user_id ?? null,
    auth_provider: user.auth_provider || 'email',
    auth_method: authMethod,
    must_change_password: user.must_change_password !== false,
    logged_in_at: new Date().toISOString(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

/* ------------------------------------------------------------------ */
/* Langkah kedua login: kode dari aplikasi authenticator (TOTP)        */
/* ------------------------------------------------------------------ */
const PENDING_KEY = 'assalam.tu.mfa_pending';
/** Batas waktu menyelesaikan langkah MFA (15 menit). */
const PENDING_TTL_MS = 15 * 60 * 1000;

function setPendingMfa(payload) {
  try {
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ ...payload, at: new Date().toISOString() }),
    );
  } catch {
    /* diabaikan */
  }
}

/**
 * Data langkah-2 yang sedang menunggu kode (null bila tidak ada / kadaluarsa).
 * Dipakai halaman login agar bisa lanjut ke input kode walau halaman di-refresh.
 */
export function getPendingMfa() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || Date.now() - new Date(parsed.at).getTime() > PENDING_TTL_MS) {
      localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearPendingMfa() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* diabaikan */
  }
}

/** Baris pengguna aplikasi (tabel users) berdasarkan email. */
function findUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return (getDB().users || []).find((u) => String(u.email).toLowerCase() === normalized) || null;
}

/**
 * Email akun guest Microsoft (B2B) berbentuk
 * `nama_gmail.com#EXT#@tenant.onmicrosoft.com`; kembalikan bentuk aslinya
 * (`nama@gmail.com`) supaya bisa dicocokkan dengan baris pengguna.
 */
function emailFromGuestUpn(value) {
  const text = String(value || '').trim();
  if (!text.includes('#EXT#')) return null;
  const local = text.split('#EXT#')[0];
  const at = local.lastIndexOf('_');
  if (at <= 0) return null;
  return `${local.slice(0, at)}@${local.slice(at + 1)}`.toLowerCase();
}

/**
 * Cocokkan akun Supabase Auth dengan baris pengguna aplikasi (role & hak akses):
 * lewat kolom `auth_user_id` lebih dulu, lalu email (termasuk email guest
 * Microsoft), lalu metadata dari provider.
 */
function resolveAuthUser(authUser) {
  if (!authUser) return null;
  const users = getDB().users || [];

  const byId = users.find((u) => u.auth_user_id && u.auth_user_id === authUser.id);
  if (byId) return byId;

  const candidates = [
    authUser.email,
    emailFromGuestUpn(authUser.email),
    authUser.user_metadata?.email,
    authUser.user_metadata?.preferred_username,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  return users.find((u) => candidates.includes(String(u.email).trim().toLowerCase())) || null;
}

/** Penyedia login yang dipakai akun Supabase Auth ('email', 'google', dst.). */
function providerOf(authUser) {
  if (!authUser) return 'email';
  return authUser.app_metadata?.provider || 'oauth';
}

/** Nama penyedia login untuk pesan ke pengguna. */
function providerLabel(provider) {
  if (provider === 'google') return 'Google';
  if (provider === 'azure') return 'Microsoft';
  return 'SSO';
}

/**
 * Catat waktu login terakhir dan sambungkan baris pengguna dengan akun
 * Supabase Auth (kolom auth_user_id + auth_provider).
 */
function markLogin(user, authUser) {
  const now = new Date().toISOString();
  const authUserId = authUser?.id ?? null;
  const provider = authUser ? providerOf(authUser) : user.auth_provider || 'email';

  commit((draft) => {
    const target = (draft.users || []).find((u) => u.id === user.id);
    if (!target) return;
    target.last_login_at = now;
    if (authUserId && target.auth_user_id !== authUserId) target.auth_user_id = authUserId;
    if (authUser && target.auth_provider !== provider) target.auth_provider = provider;
  });

  return {
    ...user,
    auth_user_id: authUserId ?? user.auth_user_id ?? null,
    auth_provider: authUser ? provider : user.auth_provider || 'email',
  };
}

/** Penyedia login SSO yang tersedia di aplikasi ini. */
export const SSO_PROVIDERS = {
  google: { slug: 'google', label: 'Google', scopes: 'email openid profile' },
};

/**
 * Login memakai penyedia SSO (akun Google). Password dan verifikasi dua langkah
 * ditangani penyedianya; aplikasi hanya menerima sesi Supabase hasil login itu.
 */
export async function loginWithSso(provider = 'google', redirectTo) {
  const config = SSO_PROVIDERS[provider];
  if (!config) return { ok: false, error: `Penyedia login ${provider} tidak dikenal.` };

  if (!isSupabaseAuthEnabled) {
    return {
      ok: false,
      error: `Login ${config.label} memerlukan Supabase (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY pada .env).`,
    };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: config.slug,
    options: {
      scopes: config.scopes,
      redirectTo: redirectTo || `${window.location.origin}/`,
    },
  });

  if (error) {
    return { ok: false, error: `Gagal membuka halaman login ${config.label}: ${error.message}` };
  }
  // Halaman berpindah ke penyedia login; sisanya ditangani redirect balik.
  return { ok: true };
}

/** Pintasan login Google (dipakai halaman login). */
export function loginWithGoogle(redirectTo) {
  return loginWithSso('google', redirectTo);
}

/** Apakah sesi Supabase Auth masih hidup (user SSO tidak punya password). */
export async function ensureActiveAuthSession() {
  if (!isSupabaseAuthEnabled) return true;
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data?.session);
  } catch {
    return false;
  }
}

const LOCKED_MESSAGE =
  'Akun terkunci karena 3 kali salah password. Silakan hubungi Administrator untuk membuka akses.';

/** Catat percobaan login gagal, kembalikan pesan sisa percobaan / status kunci. */
function failAttempt(normalizedEmail, label = 'Password') {
  const count = registerFailedAttempt(normalizedEmail);
  const remaining = Math.max(MAX_ATTEMPTS - count, 0);
  if (remaining <= 0) return { ok: false, locked: true, error: LOCKED_MESSAGE };
  return {
    ok: false,
    remaining,
    error: `${label} salah. Sisa ${remaining} percobaan sebelum akun terkunci.`,
  };
}

export async function login(email, password) {
  await ensureSeedUsers();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const state = getLoginAttemptState(normalizedEmail);
  if (state.locked) {
    return { ok: false, locked: true, error: LOCKED_MESSAGE };
  }

  if (isSupabaseAuthEnabled) {
    // Password diverifikasi Supabase Auth (hash ditangani server, bukan browser).
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      if (/invalid login credentials/i.test(error.message)) return failAttempt(normalizedEmail);
      if (/email not confirmed/i.test(error.message)) {
        return {
          ok: false,
          error:
            'Email belum dikonfirmasi di Supabase. Minta Administrator mengaktifkan akun di Supabase → Authentication → Users.',
        };
      }
      return { ok: false, error: `Login gagal: ${error.message}` };
    }

    // Akun SSO (Google/Microsoft) tidak punya password di aplikasi ini.
    const known = findUserByEmail(normalizedEmail);
    if (known?.auth_provider && known.auth_provider !== 'email') {
      await supabase.auth.signOut();
      return {
        ok: false,
        error: `Akun ini memakai login ${providerLabel(known.auth_provider)}. Gunakan tombol “Masuk dengan ${providerLabel(known.auth_provider)}”.`,
      };
    }

    // Role & hak akses tetap dibaca dari tabel users (dicocokkan lewat email).
    const user = findUserByEmail(normalizedEmail);
    if (!user) {
      await supabase.auth.signOut();
      return {
        ok: false,
        error:
          `Login Supabase berhasil, tetapi email ${normalizedEmail} belum terdaftar sebagai pengguna aplikasi. ` +
          'Samakan email akun Supabase dengan baris pada tabel users (mis. admin@assalam.sch.id) atau tambahkan baris pengguna dengan email tersebut.',
      };
    }
    if (user.is_active === false) {
      await supabase.auth.signOut();
      return {
        ok: false,
        locked: true,
        error: 'Akun ini dinonaktifkan. Silakan hubungi Administrator.',
      };
    }

    resetLoginAttempts(normalizedEmail);

    // Langkah kedua: kode dari aplikasi authenticator. Sesi aplikasi baru
    // dibuat setelah kode diverifikasi (lihat verifyTotp / startTotpEnrollment).
    const mfa = await describeMfaState();
    setPendingMfa({ email: normalizedEmail, userId: user.id, mode: mfa.mode });
    return {
      ok: true,
      requiresMfa: true,
      mfaMode: mfa.mode, // 'verify' (sudah punya authenticator) | 'enroll' (belum)
      factorId: mfa.factorId,
      email: normalizedEmail,
      user,
    };
  }

  /* --- Mode lokal (Supabase belum dikonfigurasi): hash lokal --- */
  const user = findUserByEmail(normalizedEmail);
  if (!user) {
    return { ok: false, error: 'Email tidak terdaftar.' };
  }

  if (user.is_active === false) {
    return {
      ok: false,
      locked: true,
      error: 'Akun ini dinonaktifkan. Silakan hubungi Administrator.',
    };
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return failAttempt(normalizedEmail);

  resetLoginAttempts(normalizedEmail);
  const session = saveSession(markLogin(user, null), 'password');
  return { ok: true, session, user };
}

/**
 * Kondisi MFA akun yang sedang login: apakah sudah punya authenticator
 * terverifikasi atau masih perlu mendaftarkan.
 */
async function describeMfaState() {
  try {
    const { data } = await supabase.auth.mfa.listFactors();
    const totp = data?.totp || [];
    const verified = totp.find((factor) => factor.status === 'verified');
    if (verified) return { mode: 'verify', factorId: verified.id };
    return { mode: 'enroll', factorId: null };
  } catch {
    return { mode: 'enroll', factorId: null };
  }
}

/**
 * Mulai pendaftaran authenticator (TOTP) untuk pengguna yang sedang login.
 * Mengembalikan QR (data URI) + kode rahasia untuk dimasukkan manual.
 */
export async function startTotpEnrollment() {
  if (!isSupabaseAuthEnabled) {
    return { ok: false, error: 'MFA memerlukan Supabase Auth (env var belum diisi).' };
  }

  // Bersihkan faktor yang belum pernah diverifikasi agar tidak menumpuk.
  try {
    const { data } = await supabase.auth.mfa.listFactors();
    const pending = (data?.totp || []).filter((factor) => factor.status !== 'verified');
    for (const factor of pending) {
      // eslint-disable-next-line no-await-in-loop
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (unenrollError) {
        console.warn('[auth] Gagal membersihkan faktor MFA lama:', unenrollError.message);
      }
    }
  } catch (error) {
    console.warn('[auth] Gagal membaca daftar faktor MFA:', error?.message || error);
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    // Nama faktor harus unik per akun — kalau tidak, Supabase menolak dengan
    // "A factor with the friendly name ... already exists".
    friendlyName: `Sistem TU ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`,
  });

  if (error) {
    const conflict = /already exists/i.test(error.message);
    return {
      ok: false,
      error: conflict
        ? 'Masih ada pendaftaran authenticator lama yang belum selesai di akun ini. Hapus faktor tersebut dulu di Supabase → Authentication → Users → user → bagian Factors, lalu klik Coba lagi.'
        : `Gagal memulai pendaftaran authenticator: ${error.message}`,
    };
  }

  return {
    ok: true,
    factorId: data.id,
    qrCode: data.totp?.qr_code ?? null,
    secret: data.totp?.secret ?? null,
  };
}

/**
 * Verifikasi kode 6 angka dari aplikasi authenticator.
 * Dipakai untuk menyelesaikan pendaftaran maupun login berikutnya, lalu
 * membuka sesi aplikasi (session menjadi aal2 di Supabase).
 */
export async function verifyTotp(factorId, code, { expectedUserId } = {}) {
  if (!isSupabaseAuthEnabled) {
    return { ok: false, error: 'MFA memerlukan Supabase Auth (env var belum diisi).' };
  }

  const cleanCode = String(code || '').replace(/\D/g, '');
  if (cleanCode.length !== 6) return { ok: false, error: 'Kode terdiri dari 6 angka.' };
  if (!factorId) return { ok: false, error: 'Sesi MFA tidak ditemukan. Silakan login ulang.' };

  const pending = getPendingMfa();
  const email = pending?.email || '';

  const state = email ? getLoginAttemptState(email) : { locked: false };
  if (state.locked) return { ok: false, locked: true, error: LOCKED_MESSAGE };

  const { data, error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: cleanCode,
  });

  if (error) {
    if (email && /invalid|expired|code/i.test(error.message)) return failAttempt(email, 'Kode');
    return { ok: false, error: `Verifikasi kode gagal: ${error.message}` };
  }

  // Ambil akun dari sesi Supabase (sudah aal2) lalu cocokkan dengan baris pengguna.
  let authUser = data?.user ?? null;
  if (!authUser) {
    const { data: sessionData } = await supabase.auth.getUser();
    authUser = sessionData?.user ?? null;
  }

  const user = resolveAuthUser(authUser) || findUserByEmail(email);
  if (!user || user.is_active === false) {
    await supabase.auth.signOut();
    clearPendingMfa();
    return {
      ok: false,
      error: 'Akun ini belum terdaftar sebagai pengguna aplikasi. Hubungi Administrator TU.',
    };
  }

  // Kode harus milik akun yang sama seperti langkah password.
  if (expectedUserId && user.id !== expectedUserId) {
    await supabase.auth.signOut();
    clearPendingMfa();
    return { ok: false, error: 'Kode ini milik akun lain. Silakan ulangi login dari awal.' };
  }

  if (email) resetLoginAttempts(email);
  clearPendingMfa();
  const linked = markLogin(user, authUser);
  const session = saveSession(linked, 'password');
  return { ok: true, session, user: linked };
}

/**
 * Pulihkan sesi aplikasi dari sesi Supabase Auth yang masih hidup.
 * Mengembalikan null bila sesi Supabase sudah tidak ada (mis. kadaluarsa,
 * logout di tab lain, atau akunnya sudah tidak aktif).
 */
/** Sesuaikan akun dari sesi Supabase yang tersimpan (null bila belum ada). */
async function readAuthUser() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user ?? null;
  } catch {
    return null;
  }
}

/** URL hasil redirect OAuth (login Microsoft) yang belum diproses Supabase. */
function hasAuthParamsInUrl() {
  if (typeof window === 'undefined') return false;
  const { search, hash } = window.location;
  return (
    /[?&](code|access_token|error_description)=/.test(search) ||
    /(access_token|error_description)=/.test(hash)
  );
}

export async function restoreSession() {
  const stored = getSession();
  if (!isSupabaseAuthEnabled) return stored;

  // Login dua langkah yang belum selesai: jangan pulihkan sesi walau sesi
  // password Supabase masih hidup di browser.
  if (getPendingMfa()) {
    clearSession();
    return null;
  }

  let authUser = await readAuthUser();

  // Kembali dari login Microsoft: Supabase masih menukar kode di URL jadi sesi.
  if (!authUser && hasAuthParamsInUrl()) {
    for (let attempt = 0; attempt < 5 && !authUser; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 300));
      // eslint-disable-next-line no-await-in-loop
      authUser = await readAuthUser();
    }
  }

  if (!authUser) {
    if (stored) clearSession();
    return null;
  }

  // Punya authenticator tapi kodenya belum diverifikasi (masih aal1) → tolak.
  try {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
      clearSession();
      return null;
    }
  } catch {
    /* diabaikan — bila API MFA tidak tersedia, lanjut memakai sesi biasa */
  }

  const user = resolveAuthUser(authUser);
  if (!user || user.is_active === false) {
    await supabase.auth.signOut();
    clearSession();
    return null;
  }

  if (stored && String(stored.user_id) === String(user.id)) return stored;

  // Simpan cara login (password / kode email / SSO) agar perilaku sesi konsisten
  // setelah halaman dimuat ulang.
  const method =
    stored?.auth_method ||
    readAuthMethod(user.id) ||
    (providerOf(authUser) !== 'email' ? 'sso' : 'password');
  return saveSession(markLogin(user, authUser), method);
}

/**
 * Password default bawaan yang sebaiknya segera diganti pengguna.
 * Hanya berlaku untuk login dengan password — user kode email / SSO tidak
 * punya password di aplikasi ini.
 */
export function shouldPromptPasswordChange(account) {
  if (!account) return false;
  if (account.auth_method) {
    return account.auth_method === 'password' && account.must_change_password !== false;
  }
  if (account.auth_provider && account.auth_provider !== 'email') return false;
  return account.must_change_password !== false;
}

export function logout() {
  clearSession();
  clearPendingMfa();
  if (isSupabaseAuthEnabled) {
    // Hapus juga sesi Supabase agar tidak bisa dipulihkan dari localStorage.
    supabase.auth.signOut().catch(() => {});
  }
}

export async function changePassword(userId, currentPassword, newPassword) {
  const db = getDB();
  const user = (db.users || []).find((u) => u.id === userId);
  if (!user) return { ok: false, error: 'Pengguna tidak ditemukan.' };
  if (user.auth_provider && user.auth_provider !== 'email') {
    return {
      ok: false,
      error: `Akun ini memakai login ${providerLabel(user.auth_provider)} — passwordnya diatur di akun ${providerLabel(user.auth_provider)} Anda.`,
    };
  }
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: 'Password baru minimal 6 karakter.' };
  }

  if (isSupabaseAuthEnabled) {
    // Supabase tidak punya endpoint "cek password lama", jadi password saat ini
    // diverifikasi dengan login ulang (sesi tetap milik pengguna yang sama).
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) return { ok: false, error: 'Password saat ini salah.' };

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: `Gagal mengubah password: ${error.message}` };

    // Hash lokal tidak dipakai lagi, tetapi dibersihkan agar tidak jadi cadangan lemah.
    commit((draft) => {
      const target = draft.users.find((u) => u.id === userId);
      if (target) target.password_hash = '';
    });
  } else {
    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) return { ok: false, error: 'Password saat ini salah.' };

    const password_hash = await hashPassword(newPassword);
    commit((draft) => {
      const target = draft.users.find((u) => u.id === userId);
      if (target) target.password_hash = password_hash;
    });
  }

  commit((draft) => {
    const target = draft.users.find((u) => u.id === userId);
    if (target) {
      target.must_change_password = false;
      target.password_changed_at = new Date().toISOString();
    }
  });

  // Segarkan sesi aktif agar popup "ganti password" tidak muncul lagi.
  const session = getSession();
  if (session && session.user_id === userId) {
    const next = { ...session, must_change_password: false };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } catch {
      /* diabaikan */
    }
  }

  return { ok: true };
}

export function updateProfile(userId, payload) {
  const current = (getDB().users || []).find((u) => u.id === userId);
  const nextEmail = String(payload.email ?? current?.email ?? '').trim().toLowerCase();
  // Email adalah identitas login di Supabase Auth. Bila diubah di sini tanpa
  // mengubah akun Supabase, pengguna akan terkunci dari baris pengguna ini —
  // jadi perubahan email dilakukan lewat dashboard Supabase.
  if (isSupabaseAuthEnabled && current && nextEmail !== String(current.email).toLowerCase()) {
    return null;
  }

  return commit((draft) => {
    const target = draft.users.find((u) => u.id === userId);
    if (!target) return null;
    Object.assign(target, {
      name: payload.name ?? target.name,
      email: payload.email ?? target.email,
      updated_at: new Date().toISOString(),
    });
    return target;
  }).result;
}

export function listUsers() {
  return (getDB().users || [])
    .map(({ password_hash, ...rest }) => rest)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'id'));
}

/** Daftar pengguna + status terkunci percobaan login. */
export function listUsersWithStatus() {
  return listUsers().map((user) => ({
    ...user,
    loginAttempt: getLoginAttemptState(user.email),
    isActive: user.is_active !== false,
  }));
}

export function getUser(id) {
  return (getDB().users || []).find((user) => user.id === id) || null;
}

/** Verifikasi ulang password pengguna (dipakai untuk konfirmasi sesi). */
export async function verifyUserPassword(userId, password) {
  const user = getUser(userId);
  if (!user) return { ok: false, error: 'Pengguna tidak ditemukan.' };
  if (user.auth_provider && user.auth_provider !== 'email') {
    return {
      ok: false,
      error: `Akun ini memakai login ${providerLabel(user.auth_provider)} — konfirmasi password tidak berlaku.`,
    };
  }

  if (isSupabaseAuthEnabled) {
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    return error ? { ok: false, error: 'Password salah.' } : { ok: true };
  }

  const valid = await verifyPassword(password, user.password_hash);
  return valid ? { ok: true } : { ok: false, error: 'Password salah.' };
}

export async function createUser({ name, email, role, password, permissions }) {
  const db = getDB();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!name || !name.trim()) return { ok: false, error: 'Nama pengguna wajib diisi.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
    return { ok: false, error: 'Format email tidak valid.' };
  }
  if (!ROLE_KEYS.includes(role)) return { ok: false, error: 'Role tidak valid.' };
  if (String(password || '').length < 6) {
    return { ok: false, error: 'Password minimal 6 karakter.' };
  }
  if ((db.users || []).some((user) => user.email.toLowerCase() === normalizedEmail)) {
    return { ok: false, error: `Email ${normalizedEmail} sudah terdaftar.` };
  }

  // Buat akun login Supabase Auth lebih dulu (bila layanan admin tersedia).
  let authUserId = null;
  let warning;
  if (isSupabaseAuthEnabled) {
    const auth = await callAdminUsers({ action: 'create', email: normalizedEmail, password });
    if (auth.ok) {
      authUserId = auth.auth_user_id ?? null;
    } else if (auth.unavailable) {
      warning =
        `Akun login Supabase belum dibuat otomatis. Deploy Edge Function “admin-users” ` +
        `(supabase functions deploy admin-users), atau tambahkan user ${normalizedEmail} di ` +
        'Supabase → Authentication → Users agar bisa masuk.';
    } else {
      return { ok: false, error: auth.error || 'Gagal membuat akun login Supabase.' };
    }
  }

  const user = {
    id: uid('usr'),
    name: name.trim(),
    email: normalizedEmail,
    role,
    // Hash lokal hanya dipakai saat Supabase belum dikonfigurasi (mode lokal).
    password_hash: isSupabaseAuthEnabled ? '' : await hashPassword(password),
    must_change_password: true,
    is_active: true,
    auth_user_id: authUserId,
    auth_provider: 'email',
    permission_overrides: permissions && Object.keys(permissions).length ? permissions : null,
    created_at: new Date().toISOString(),
    last_login_at: null,
  };

  commit((draft) => {
    draft.users = [...(draft.users || []), user];
  });
  return { ok: true, user, warning };
}

export function updateUser(id, payload) {
  const current = getUser(id);
  if (!current) return { ok: false, error: 'Pengguna tidak ditemukan.' };

  const normalizedEmail = String(payload.email ?? current.email).trim().toLowerCase();
  const duplicate = (getDB().users || []).find(
    (user) => user.id !== id && user.email.toLowerCase() === normalizedEmail,
  );
  if (duplicate) return { ok: false, error: `Email ${normalizedEmail} sudah dipakai pengguna lain.` };
  if (payload.role && !ROLE_KEYS.includes(payload.role)) {
    return { ok: false, error: 'Role tidak valid.' };
  }

  const updated = {
    ...current,
    name: payload.name?.trim() || current.name,
    email: normalizedEmail,
    role: payload.role ?? current.role,
    is_active: payload.is_active ?? current.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  commit((draft) => {
    const index = (draft.users || []).findIndex((user) => user.id === id);
    if (index >= 0) draft.users[index] = updated;
  });
  return { ok: true, user: updated };
}

export async function resetUserPassword(id, newPassword = DEFAULT_PASSWORD) {
  const current = getUser(id);
  if (!current) return { ok: false, error: 'Pengguna tidak ditemukan.' };
  if (String(newPassword).length < 6) return { ok: false, error: 'Password minimal 6 karakter.' };

  if (isSupabaseAuthEnabled) {
    // Password dikelola Supabase Auth — diubah lewat Edge Function admin-users.
    const auth = await callAdminUsers({
      action: 'update_password',
      email: current.email,
      auth_user_id: current.auth_user_id,
      password: newPassword,
    });
    resetLoginAttempts(current.email);
    if (auth.ok) {
      // Akun login bisa baru dibuat oleh Edge Function (baris pengguna lama yang
      // belum punya akun Supabase Auth) — simpan id-nya agar tautan tetap utuh.
      if (auth.auth_user_id && auth.auth_user_id !== current.auth_user_id) {
        commit((draft) => {
          const target = (draft.users || []).find((user) => user.id === id);
          if (target) target.auth_user_id = auth.auth_user_id;
        });
      }
      return { ok: true, passwordSet: true, createdAuth: Boolean(auth.created) };
    }
    if (auth.unavailable) {
      return {
        ok: true,
        warning:
          'Penghitung salah password sudah dibuka. Password login diatur Supabase Auth — ubah di ' +
          'Supabase → Authentication → Users, atau deploy Edge Function “admin-users”.',
      };
    }
    return { ok: false, error: auth.error || 'Gagal mengubah password.' };
  }

  const password_hash = await hashPassword(newPassword);
  commit((draft) => {
    const target = (draft.users || []).find((user) => user.id === id);
    if (target) {
      target.password_hash = password_hash;
      target.must_change_password = true;
      target.updated_at = new Date().toISOString();
    }
  });
  resetLoginAttempts(current.email);
  return { ok: true };
}

export function setUserActive(id, active) {
  const current = getUser(id);
  if (!current) return { ok: false, error: 'Pengguna tidak ditemukan.' };
  if (!active && current.role === ROLES.ADMINISTRATOR) {
    const admins = (getDB().users || []).filter(
      (user) => user.role === ROLES.ADMINISTRATOR && user.is_active !== false,
    );
    if (admins.length <= 1) {
      return { ok: false, error: 'Minimal satu Administrator harus tetap aktif.' };
    }
  }
  commit((draft) => {
    const target = (draft.users || []).find((user) => user.id === id);
    if (target) {
      target.is_active = Boolean(active);
      target.updated_at = new Date().toISOString();
    }
  });
  return { ok: true };
}

export async function deleteUser(id, currentUserId) {
  const current = getUser(id);
  if (!current) return { ok: false, error: 'Pengguna tidak ditemukan.' };
  if (id === currentUserId) {
    return { ok: false, error: 'Anda tidak dapat menghapus akun yang sedang digunakan.' };
  }
  if (current.role === ROLES.ADMINISTRATOR) {
    const admins = (getDB().users || []).filter((user) => user.role === ROLES.ADMINISTRATOR);
    if (admins.length <= 1) {
      return { ok: false, error: 'Minimal satu akun Administrator harus tersedia.' };
    }
  }

  // Hapus juga akun login Supabase Auth (bila layanan admin tersedia).
  let warning;
  if (isSupabaseAuthEnabled) {
    const auth = await callAdminUsers({
      action: 'delete',
      email: current.email,
      auth_user_id: current.auth_user_id,
    });
    if (auth.unavailable) {
      warning =
        'Pengguna dihapus dari aplikasi, tetapi akun login Supabase tidak dihapus otomatis. ' +
        'Hapus manual di Supabase → Authentication → Users, atau deploy Edge Function “admin-users”.';
    } else if (!auth.ok) {
      warning = `Pengguna dihapus dari aplikasi, tetapi akun login Supabase gagal dihapus: ${auth.error}`;
    }
  }

  commit((draft) => {
    draft.users = (draft.users || []).filter((user) => user.id !== id);
  });
  return { ok: true, warning };
}

/** Ringkasan jumlah pengguna per role untuk dashboard admin. */
export function getUserStats() {
  const users = getDB().users || [];
  return {
    total: users.length,
    aktif: users.filter((user) => user.is_active !== false).length,
    nonaktif: users.filter((user) => user.is_active === false).length,
    perRole: Object.fromEntries(
      ROLE_KEYS.map((role) => [role, users.filter((user) => user.role === role).length]),
    ),
  };
}
