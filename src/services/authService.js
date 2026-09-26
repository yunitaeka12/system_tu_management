/**
 * Service autentikasi.
 *
 * Password disimpan sebagai hash SHA-256 + salt (tidak pernah plain text).
 * Struktur role sengaja dibuat array agar mudah ditambah
 * (administrator, tu, kepala_sekolah, bendahara).
 */
import { getDB, commit, hashPassword, verifyPassword } from '../lib/db';
import { uid } from '../utils/helpers';

const SESSION_KEY = 'assalam.tu.session';

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
        password_hash: await hashPassword(DEFAULT_PASSWORD),
        created_at: new Date().toISOString(),
        last_login_at: null,
      };
      users.push(user);
      created.push(user);
      continue;
    }

    // Migrasi akun lama (mis. admin123) ke password default terbaru.
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

function saveSession(user) {
  const session = {
    user_id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    must_change_password: user.must_change_password !== false,
    logged_in_at: new Date().toISOString(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function login(email, password) {
  await ensureSeedUsers();
  const db = getDB();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = (db.users || []).find((u) => u.email.toLowerCase() === normalizedEmail);

  const state = getLoginAttemptState(normalizedEmail);
  if (state.locked) {
    return {
      ok: false,
      locked: true,
      error:
        'Akun terkunci karena 3 kali salah password. Silakan hubungi Administrator untuk membuka akses.',
    };
  }

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
  if (!valid) {
    const count = registerFailedAttempt(normalizedEmail);
    const remaining = Math.max(MAX_ATTEMPTS - count, 0);
    if (remaining <= 0) {
      return {
        ok: false,
        locked: true,
        error:
          'Akun terkunci karena 3 kali salah password. Silakan hubungi Administrator untuk membuka akses.',
      };
    }
    return {
      ok: false,
      remaining,
      error: `Password salah. Sisa ${remaining} percobaan sebelum akun terkunci.`,
    };
  }

  resetLoginAttempts(normalizedEmail);

  commit((draft) => {
    const target = draft.users.find((u) => u.id === user.id);
    if (target) target.last_login_at = new Date().toISOString();
  });

  const session = saveSession(user);
  return { ok: true, session, user };
}

/** Password default bawaan yang sebaiknya segera diganti pengguna. */
export function shouldPromptPasswordChange(user) {
  if (!user) return false;
  return user.must_change_password !== false;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

export async function changePassword(userId, currentPassword, newPassword) {
  const db = getDB();
  const user = (db.users || []).find((u) => u.id === userId);
  if (!user) return { ok: false, error: 'Pengguna tidak ditemukan.' };

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) return { ok: false, error: 'Password saat ini salah.' };
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: 'Password baru minimal 6 karakter.' };
  }

  const password_hash = await hashPassword(newPassword);
  commit((draft) => {
    const target = draft.users.find((u) => u.id === userId);
    if (target) {
      target.password_hash = password_hash;
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

  const user = {
    id: uid('usr'),
    name: name.trim(),
    email: normalizedEmail,
    role,
    password_hash: await hashPassword(password),
    must_change_password: true,
    is_active: true,
    permission_overrides: permissions && Object.keys(permissions).length ? permissions : null,
    created_at: new Date().toISOString(),
    last_login_at: null,
  };

  commit((draft) => {
    draft.users = [...(draft.users || []), user];
  });
  return { ok: true, user };
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

export function deleteUser(id, currentUserId) {
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

  commit((draft) => {
    draft.users = (draft.users || []).filter((user) => user.id !== id);
  });
  return { ok: true };
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
