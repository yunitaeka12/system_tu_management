/**
 * Klien Supabase.
 *
 * Aplikasi tetap bisa berjalan tanpa Supabase (mode lokal / localStorage):
 * bila env var tidak diisi atau jaringan bermasalah, semua fitur tetap
 * bekerja dan sinkronisasi otomatis dilewati.
 */
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(URL && ANON_KEY);

/**
 * Project ref Supabase (diambil dari URL) — dipakai Admin Panel untuk
 * menampilkan perintah deploy Edge Function yang siap salin-tempel.
 */
export const supabaseProjectRef =
  String(URL ?? '').match(/^https?:\/\/([a-z0-9-]+)\.supabase\./i)?.[1] ?? '';

/**
 * Login memakai Supabase Auth (bukan password lokal) bila env var tersedia.
 * Sesi disimpan Supabase sendiri di localStorage lalu divalidasi ulang saat
 * aplikasi dibuka (lihat restoreSession di services/authService).
 */
export const isSupabaseAuthEnabled = isSupabaseConfigured;

export const supabase = isSupabaseConfigured
  ? createClient(URL, ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Login Microsoft (Azure) kembali ke aplikasi lewat URL — sesinya
        // diambil otomatis dari parameter yang dikirim Supabase.
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      realtime: { params: { eventsPerSecond: 2 } },
    })
  : null;

/* ------------------------------------------------------------------ */
/* Status sinkronisasi (dipakai indikator di header)                    */
/* ------------------------------------------------------------------ */
const listeners = new Set();

let state = {
  configured: isSupabaseConfigured,
  status: isSupabaseConfigured ? 'idle' : 'local', // idle | syncing | synced | error | local
  lastSyncAt: null,
  lastError: null,
  pulled: false,
};

export function getSyncState() {
  return state;
}

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
}

export function subscribeSync(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const syncState = {
  syncing: () => setState({ status: 'syncing', lastError: null }),
  synced: () => setState({ status: 'synced', lastSyncAt: new Date().toISOString(), lastError: null }),
  error: (message) => setState({ status: 'error', lastError: String(message || 'Gagal sinkronisasi') }),
  local: () => setState({ status: 'local' }),
  pulled: () => setState({ pulled: true }),
};

/** Nama tabel di Supabase yang dipakai aplikasi. */
export const TABLES = [
  'academic_years',
  'students',
  'users',
  'payments',
  'student_ekskul',
  'ekskul_payments',
  'payment_adjustments',
];
