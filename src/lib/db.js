/**
 * Data layer aplikasi — local-first + sinkronisasi Supabase.
 *
 * Cara kerja:
 *  1. `getDB()` selalu membaca cache di memori (sinkron) sehingga seluruh
 *     service/hook/komponen tidak perlu berubah dan UI tetap responsif.
 *  2. Setiap perubahan ditulis ke localStorage (agar tahan refresh) lalu
 *     dijadwalkan untuk dikirim ke Supabase (debounce).
 *  3. Saat aplikasi dibuka, `initDB()` menarik data dari Supabase bila
 *     tersedia. Jika project masih kosong, data lokal (hasil import Excel)
 *     diunggah sebagai data awal.
 *  4. Bila Supabase tidak dikonfigurasi atau jaringan bermasalah, aplikasi
 *     otomatis berjalan penuh dalam mode lokal.
 *
 * Bentuk tabel sengaja mengikuti skema PostgreSQL pada `supabase/schema.sql`
 * (students, users, payments, academic_years, student_ekskul, ekskul_payments).
 */
import seedData from '../data/students.seed.json';
import { uid } from '../utils/helpers';
import { currentAcademicYearLabel } from '../utils/helpers';
import {
  isSupabaseConfigured,
  supabase,
  syncState,
  subscribeSync,
  getSyncState,
  TABLES,
} from './supabase';

const STORAGE_KEY = 'assalam.tu.db.v1';
const DIRTY_KEY = 'assalam.tu.db.dirty';
const DB_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Password hashing (SHA-256 + salt, via Web Crypto)                    */
/* ------------------------------------------------------------------ */
const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const hasSubtleCrypto =
  typeof crypto !== 'undefined' && typeof crypto.subtle?.digest === 'function';
const hasGetRandomValues =
  typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function';

/** Generator salt acak 16 byte (hex). */
function randomSalt() {
  if (hasGetRandomValues) return toHex(crypto.getRandomValues(new Uint8Array(16)));
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Fallback non-kriptografis untuk konteks tidak aman (mis. diakses via IP LAN
 * tanpa HTTPS) di mana Web Crypto tidak tersedia. Hanya dipakai bila
 * crypto.subtle benar-benar tidak ada.
 */
function hashFallback(input) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Hash password. Memakai SHA-256 + salt bila Web Crypto tersedia; jika tidak
 * (bukan secure context) memakai fallback dengan peringatan di console.
 */
export async function hashPassword(password, salt) {
  const usedSalt = salt || randomSalt();
  const data = `${usedSalt}::${password}`;

  if (hasSubtleCrypto) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return `${usedSalt}:${toHex(digest)}`;
  }

  console.warn(
    '[db] crypto.subtle tidak tersedia (akses non-HTTPS). Password memakai fallback hash non-kriptografis — jalankan aplikasi lewat HTTPS/localhost untuk mode aman.',
  );
  return `${usedSalt}:${hashFallback(data)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt] = stored.split(':');
  const candidate = await hashPassword(password, salt);
  return candidate === stored;
}

/* ------------------------------------------------------------------ */
/* Seed awal                                                           */
/* ------------------------------------------------------------------ */
function buildInitialDB() {
  const now = new Date().toISOString();
  const activeYear = currentAcademicYearLabel();

  const students = (seedData.students || []).map((student, index) => ({
    id: `stu_${student.no_induk}`,
    ...student,
    created_at: now,
    updated_at: now,
    _order: index,
  }));

  return {
    version: DB_VERSION,
    seeded_at: now,
    source_file: seedData.source || null,
    academic_years: [
      {
        id: `ay_${activeYear.replace('/', '-')}`,
        nama_tahun_ajaran: activeYear,
        tahun_mulai: Number(activeYear.split('/')[0]),
        tahun_selesai: Number(activeYear.split('/')[1]),
        status: 'aktif',
        created_at: now,
      },
    ],
    students,
    payments: [],
    student_ekskul: [],
    ekskul_payments: [],
    users: [],
    meta: {
      last_student_import: null,
      counters: {},
    },
  };
}

/** Pastikan tabel baru selalu ada pada database lama. */
function withMissingTables(db) {
  return {
    ...db,
    academic_years: db.academic_years || [],
    students: db.students || [],
    payments: db.payments || [],
    student_ekskul: db.student_ekskul || [],
    ekskul_payments: db.ekskul_payments || [],
    users: db.users || [],
    meta: db.meta || { last_student_import: null, counters: {} },
  };
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */
let cache = null;
const listeners = new Set();

function persist(db) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch (error) {
    console.error('[db] Gagal menyimpan ke localStorage:', error);
    return false;
  }
}

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== DB_VERSION) return null;
    return withMissingTables(parsed);
  } catch (error) {
    console.error('[db] Data lokal rusak, membangun ulang:', error);
    return null;
  }
}

function markDirty(value = true) {
  try {
    if (value) localStorage.setItem(DIRTY_KEY, '1');
    else localStorage.removeItem(DIRTY_KEY);
  } catch {
    /* diabaikan */
  }
}

function isDirty() {
  try {
    return localStorage.getItem(DIRTY_KEY) === '1';
  } catch {
    return false;
  }
}

/** Ambil database (membangun seed bila belum ada). */
export function getDB() {
  if (cache) return cache;
  const stored = readStorage();
  if (stored) {
    cache = stored;
    return cache;
  }
  cache = buildInitialDB();
  persist(cache);
  return cache;
}

function notify() {
  listeners.forEach((listener) => listener(cache));
}

/** Simpan perubahan secara lokal, lalu jadwalkan sinkronisasi Supabase. */
export function commit(mutator) {
  const db = getDB();
  const result = mutator(db);
  const saved = persist(db);
  markDirty(true);
  notify();
  schedulePush();
  return { db, result, saved };
}

/** Berlangganan perubahan database. Mengembalikan fungsi unsubscribe. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Timpa seluruh isi DB (untuk restore / import penuh). */
export function replaceDB(nextDB) {
  cache = withMissingTables({ ...nextDB, version: DB_VERSION });
  persist(cache);
  markDirty(true);
  notify();
  schedulePush();
  return cache;
}

/** Kembalikan ke kondisi awal (data Buku Induk dari Excel, tanpa pembayaran). */
export function resetDB({ keepPayments = false } = {}) {
  const current = getDB();
  const fresh = buildInitialDB();
  if (keepPayments) {
    fresh.payments = current.payments;
    fresh.ekskul_payments = current.ekskul_payments;
    fresh.student_ekskul = current.student_ekskul;
    fresh.users = current.users;
  }
  cache = fresh;
  persist(cache);
  markDirty(true);
  notify();
  schedulePush();
  return cache;
}

/** Hapus seluruh transaksi pembayaran tanpa menyentuh data siswa. */
export function clearPayments() {
  commit((draft) => {
    draft.payments = [];
  });
}

/** Ekspor seluruh data sebagai objek (untuk backup). */
export function exportDB() {
  const db = getDB();
  return {
    ...db,
    exported_at: new Date().toISOString(),
    students: db.students.map(({ _order, ...rest }) => rest),
  };
}

export const DB_META = {
  storageKey: STORAGE_KEY,
  version: DB_VERSION,
  seedClasses: seedData.kelas || [],
  seedCount: (seedData.students || []).length,
  generatedAt: seedData.generated_at || null,
};

/* ------------------------------------------------------------------ */
/* Sinkronisasi Supabase                                               */
/* ------------------------------------------------------------------ */
const PUSH_DEBOUNCE_MS = 700;
const PAGE_SIZE = 500;
const UPSERT_CHUNK = 300;

let pushTimer = null;
let pushing = false;
let pushAgain = false;
let syncFailures = 0;

/** Setelah beberapa kali gagal, sinkronisasi otomatis dijeda sampai dicoba manual. */
const MAX_SYNC_FAILURES = 3;

/** Snapshot baris yang terakhir berhasil dikirim (untuk diff). */
const pushedSnapshot = new Map();

function rowSignature(row) {
  return JSON.stringify(row);
}

/**
 * Bersihkan baris agar aman dikirim ke PostgREST:
 * - buang field internal (diawali "_")
 * - ubah string kosong menjadi null (kolom numeric/date menolak "")
 */
function cleanRow(row) {
  const out = {};
  Object.entries(row).forEach(([key, value]) => {
    if (key.startsWith('_')) return;
    if (value === undefined) return;
    out[key] = value === '' ? null : value;
  });
  return out;
}

function snapshotTable(table) {
  const db = getDB();
  return new Map((db[table] || []).map((row) => [row.id, cleanRow(row)]));
}

async function pushTable(table) {
  const current = snapshotTable(table);
  const previous = pushedSnapshot.get(table) || new Map();

  const changed = [];
  current.forEach((row, id) => {
    const before = previous.get(id);
    if (!before || rowSignature(before) !== rowSignature(row)) changed.push(row);
  });

  for (let i = 0; i < changed.length; i += UPSERT_CHUNK) {
    const chunk = changed.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  const removed = [...previous.keys()].filter((id) => !current.has(id));
  if (removed.length > 0) {
    const { error } = await supabase.from(table).delete().in('id', removed);
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  pushedSnapshot.set(table, current);
  return changed.length;
}

/** Kirim seluruh perubahan lokal ke Supabase. */
export async function pushAll({ manual = false } = {}) {
  if (!isSupabaseConfigured) {
    syncState.local();
    return { ok: false, skipped: true };
  }

  if (manual) syncFailures = 0;
  if (syncFailures >= MAX_SYNC_FAILURES) {
    return { ok: false, suspended: true };
  }

  if (pushing) {
    pushAgain = true;
    return { ok: false, queued: true };
  }

  pushing = true;
  syncState.syncing();
  try {
    const db = getDB();
    for (const table of TABLES) {
      // eslint-disable-next-line no-await-in-loop
      await pushTable(table);
    }

    // eslint-disable-next-line no-await-in-loop
    const { error: metaError } = await supabase
      .from('app_meta')
      .upsert({ key: 'meta', value: db.meta, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (metaError) throw new Error(`app_meta: ${metaError.message}`);

    syncFailures = 0;
    markDirty(false);
    syncState.synced();
    return { ok: true };
  } catch (error) {
    syncFailures += 1;
    if (syncFailures === 1) {
      console.error('[db] Sinkronisasi ke Supabase gagal:', error);
    }
    syncState.error(
      syncFailures >= MAX_SYNC_FAILURES
        ? `${error.message} — sinkronisasi otomatis dijeda, klik untuk mencoba lagi.`
        : error.message,
    );
    return { ok: false, error: error.message };
  } finally {
    pushing = false;
    if (pushAgain) {
      pushAgain = false;
      schedulePush(0);
    }
  }
}

/** Jadwalkan sinkronisasi (digabung agar tidak membanjiri jaringan). */
export function schedulePush(delay = PUSH_DEBOUNCE_MS) {
  if (!isSupabaseConfigured) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushAll();
  }, delay);
}

async function fetchAll(table) {
  const rows = [];
  let from = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

/**
 * Inisialisasi database: tarik data dari Supabase, atau unggah data lokal
 * (seed Excel) bila project Supabase masih kosong.
 */
export async function initDB() {
  if (!isSupabaseConfigured) {
    syncState.local();
    return getDB();
  }

  try {
    syncState.syncing();

    // Ada perubahan lokal yang belum terkirim? Utamakan data lokal.
    if (!isDirty()) {
      const remoteStudents = await fetchAll('students');
      if (remoteStudents.length > 0) {
        const [academic_years, users, payments, student_ekskul, ekskul_payments, metaRows] =
          await Promise.all([
            fetchAll('academic_years'),
            fetchAll('users'),
            fetchAll('payments'),
            fetchAll('student_ekskul'),
            fetchAll('ekskul_payments'),
            fetchAll('app_meta'),
          ]);

        const local = getDB();
        cache = withMissingTables({
          ...local,
          version: DB_VERSION,
          academic_years,
          students: remoteStudents,
          users,
          payments,
          student_ekskul,
          ekskul_payments,
          meta: metaRows.find((row) => row.key === 'meta')?.value || local.meta,
        });
        persist(cache);
        TABLES.forEach((table) => pushedSnapshot.set(table, snapshotTable(table)));
        syncState.pulled();
        syncState.synced();
        notify();
        return cache;
      }
    }

    // Project Supabase masih kosong → unggah data lokal sebagai data awal.
    const result = await pushAll();
    if (result.ok) syncState.pulled();
    return getDB();
  } catch (error) {
    console.warn('[db] Supabase belum siap — aplikasi berjalan dalam mode lokal:', error.message);
    syncState.error(error.message);
    return getDB();
  }
}

export { getSyncState, subscribeSync };
export { uid };
