/**
 * Penyimpanan ringan untuk preferensi tampilan (filter, pencarian, urutan,
 * halaman) selama satu sesi tab — memakai `sessionStorage`.
 *
 * Dipakai oleh hook `useSessionState` agar filter daftar tidak hilang ketika
 * pengguna membuka detail lalu kembali. Seluruh nilai dibersihkan saat sesi
 * login berakhir (lihat `authService.clearSession`) supaya pengguna berikutnya
 * mulai dari tampilan default.
 */
const STORAGE_PREFIX = 'tu.ui:';

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Baca nilai tersimpan; `fallback` dipakai bila belum ada / rusak. */
export function readUiState(key, fallback) {
  const store = storage();
  if (!store) return fallback;
  try {
    const raw = store.getItem(STORAGE_PREFIX + key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

/** Simpan nilai (`null`/`undefined` berarti hapus). */
export function writeUiState(key, value) {
  const store = storage();
  if (!store) return;
  try {
    if (value === null || value === undefined) {
      store.removeItem(STORAGE_PREFIX + key);
      return;
    }
    store.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // sessionStorage bisa diblokir (mode privat) — abaikan, state tetap hidup.
  }
}

/** Hapus satu nilai tersimpan. */
export function clearUiState(key) {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_PREFIX + key);
  } catch {
    // diabaikan
  }
}

/** Hapus seluruh nilai tersimpan (dipakai saat logout). */
export function clearAllUiState() {
  const store = storage();
  if (!store) return;
  try {
    const keys = [];
    for (let index = 0; index < store.length; index += 1) {
      const itemKey = store.key(index);
      if (itemKey && itemKey.startsWith(STORAGE_PREFIX)) keys.push(itemKey);
    }
    keys.forEach((itemKey) => store.removeItem(itemKey));
  } catch {
    // diabaikan
  }
}
