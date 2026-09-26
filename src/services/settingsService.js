/**
 * Service pengaturan sekolah (tarif SPP & biaya ekskul).
 *
 * Nilai disimpan di `db.meta.settings` sehingga ikut tersinkron ke Supabase
 * melalui tabel `app_meta` tanpa perlu tabel baru.
 */
import { getDB, commit } from '../lib/db';

/** Tarif SPP bulanan bawaan per 2 digit awal No Induk (tahun angkatan). */
export const DEFAULT_SPP_RATES = {
  21: 260000,
  22: 260000,
  23: 260000,
  24: 270000,
  25: 270000,
  26: 270000,
};

/** Tarif berjalan bila prefix angkatan belum diatur. */
export const DEFAULT_SPP_RATE = 270000;

/** Daftar ekskul bawaan beserta biaya bulanannya. */
export const DEFAULT_EKSKUL = [
  { nama: 'Karate', biaya: 20000 },
  { nama: 'Badminton', biaya: 20000 },
  { nama: 'Futsal', biaya: 20000 },
  { nama: 'Tari', biaya: 20000 },
  { nama: 'English Club', biaya: 20000 },
  { nama: 'Arabic Club', biaya: 20000 },
  { nama: 'Japanese Club', biaya: 20000 },
  { nama: 'Qasidah', biaya: 25000 },
  { nama: 'Drumband', biaya: 25000 },
  { nama: 'Hadroh', biaya: 25000 },
  { nama: 'Marawis', biaya: 25000 },
  { nama: 'Cergam', biaya: 20000 },
  { nama: 'Kaligrafi', biaya: 20000 },
];

export const DEFAULT_EKSKUL_FEE = 20000;

/** Pengaturan lengkap yang berlaku saat ini (sudah digabung default). */
export function getSettings() {
  const stored = getDB().meta?.settings || {};
  const storedRates = stored.spp_rates;

  return {
    spp_rates:
      storedRates && typeof storedRates === 'object'
        ? { ...storedRates }
        : { ...DEFAULT_SPP_RATES },
    default_spp_rate: Number(stored.default_spp_rate) || DEFAULT_SPP_RATE,
    ekskul: Array.isArray(stored.ekskul)
      ? stored.ekskul.map((item) => ({ nama: item.nama, biaya: Number(item.biaya) || 0 }))
      : DEFAULT_EKSKUL.map((item) => ({ ...item })),
    default_ekskul_fee: Number(stored.default_ekskul_fee) || DEFAULT_EKSKUL_FEE,
  };
}

/** Tarif SPP bulanan untuk sebuah prefix tahun angkatan (2 digit). */
export function sppRateForPrefix(prefix) {
  const settings = getSettings();
  const key = String(prefix ?? '').slice(0, 2);
  const rate = settings.spp_rates[key];
  return Number(rate) > 0 ? Number(rate) : settings.default_spp_rate;
}

/** Daftar ekskul (nama + biaya) untuk dropdown. */
export function getEkskulOptions() {
  return getSettings().ekskul;
}

/** Biaya bulanan ekskul berdasarkan nama (case-insensitive). */
export function ekskulFeeByName(nama) {
  const settings = getSettings();
  const key = String(nama ?? '').trim().toLowerCase();
  const found = settings.ekskul.find((item) => item.nama.trim().toLowerCase() === key);
  return found ? Number(found.biaya) || 0 : settings.default_ekskul_fee;
}

/** Simpan pengaturan (partial update). */
export function saveSettings(patch) {
  const current = getSettings();
  commit((draft) => {
    draft.meta = {
      ...(draft.meta || {}),
      settings: { ...current, ...patch },
    };
  });
  return { ok: true };
}

/** Kembalikan seluruh pengaturan ke bawaan. */
export function resetSettings() {
  commit((draft) => {
    draft.meta = { ...(draft.meta || {}), settings: {} };
  });
  return { ok: true };
}

/** Label tahun ajaran dari prefix 2 digit, mis. "21" → "2021/2022". */
export function yearLabelFromPrefix(prefix) {
  const digits = String(prefix ?? '').trim();
  if (!/^\d{2}$/.test(digits)) return null;
  const start = 2000 + Number(digits);
  return `${start}/${start + 1}`;
}
