import { clsx } from 'clsx';

/** Gabungkan className secara kondisional. */
export function cn(...inputs) {
  return clsx(inputs);
}

/** Buat ID unik (UUID bila tersedia). */
export function uid(prefix = '') {
  const raw =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${raw}` : raw;
}

/** Ambil inisial dari nama (maks 2 huruf). */
export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Format tanggal ISO → "10 Jan 2026". */
export function formatDate(value, { withTime = false } = {}) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const formatted = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
  if (!withTime) return formatted;
  const time = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return `${formatted} • ${time}`;
}

/** Selisih waktu relatif: "2 hari lalu". */
export function timeAgo(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'baru saja';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} bulan lalu`;
  return `${Math.floor(months / 12)} tahun lalu`;
}

/** Tahun ajaran berjalan, mis. "2026/2027". */
export function currentAcademicYearLabel(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
}

/** Ambil nilai bertingkat yang aman: get(obj, 'father.nama'). */
export function get(obj, path, fallback = null) {
  const value = path
    .split('.')
    .reduce((acc, key) => (acc === null || acc === undefined ? acc : acc[key]), obj);
  return value === undefined || value === null || value === '' ? fallback : value;
}

/** Normalisasi teks untuk pencarian (lowercase, tanpa tanda baca). */
export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
