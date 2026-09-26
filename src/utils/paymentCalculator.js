/**
 * Business logic perhitungan tagihan & pembayaran.
 *
 * Aturan sekolah (tahun ajaran selalu dimulai bulan Juli):
 * Prefix 2 digit pertama No Induk = tahun angkatan siswa, dan
 * tagihan bulanan mengikuti tarif angkatan tersebut:
 *
 *   21 (TA 2021/2022) → Rp 260.000
 *   22 (TA 2022/2023) → Rp 260.000
 *   23 (TA 2023/2024) → Rp 260.000
 *   24 (TA 2024/2025) → Rp 270.000
 *   25 (TA 2025/2026) → Rp 270.000
 *   26 (TA 2026/2027) → Rp 270.000
 *
 * Total tagihan tahunan = tagihan bulanan × 12.
 */
import { sppRateForPrefix } from '../services/settingsService';

export const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const MONTHS_IN_YEAR = 12;

/** Tarif tagihan bulanan per prefix tahun angkatan No Induk. */
export const MONTHLY_FEE_BY_PREFIX = {
  '21': 260_000,
  '22': 260_000,
  '23': 260_000,
  '24': 270_000,
  '25': 270_000,
  '26': 270_000,
};

/** Tarif berjalan untuk No Induk dengan prefix yang tidak dikenal. */
export const DEFAULT_MONTHLY_FEE = 270_000;

export const PAYMENT_STATUS = {
  LUNAS: 'lunas',
  SEBAGIAN: 'sebagian',
  BELUM: 'belum',
};

export const PAYMENT_STATUS_LABEL = {
  lunas: 'Lunas',
  sebagian: 'Sebagian Dibayar',
  belum: 'Belum Bayar',
};

/**
 * Tagihan bulanan otomatis berdasarkan prefix tahun angkatan No Induk.
 * @param {string|number} noInduk
 * @returns {number}
 */
export function getMonthlyFee(noInduk) {
  const prefix = String(noInduk ?? '').trim().slice(0, 2);
  // Tarif diambil dari menu Pengaturan (bisa diubah Administrator).
  return sppRateForPrefix(prefix);
}

/**
 * Tahun ajaran ditentukan dari 4 digit awal No Induk.
 *
 *   2122 → 2021/2022
 *   2223 → 2022/2023
 *   2324 → 2023/2024
 *   2627 → 2026/2027
 *
 * @param {string|number} noInduk
 * @returns {{ prefix: string, start: number, end: number, label: string }|null}
 */
export function getAcademicYearFromNoInduk(noInduk) {
  const digits = String(noInduk ?? '').replace(/\D/g, '');
  if (digits.length < 4) return null;

  const prefix = digits.slice(0, 4);
  const start = 2000 + Number(prefix.slice(0, 2));
  const end = 2000 + Number(prefix.slice(2, 4));
  if (Number.isNaN(start) || Number.isNaN(end)) return null;

  return { prefix, start, end, label: `${start}/${end}` };
}

/** Label tahun ajaran dari No Induk, mis. "2026/2027". */
export function getAcademicYearLabelFromNoInduk(noInduk) {
  return getAcademicYearFromNoInduk(noInduk)?.label ?? null;
}

/**
 * Total tagihan tahunan = tagihan bulanan × 12.
 * @param {string|number} noInduk
 * @returns {number}
 */
export function getAnnualFee(noInduk) {
  return getMonthlyFee(noInduk) * MONTHS_IN_YEAR;
}

/**
 * Hitung status pembayaran.
 * @returns {'lunas'|'sebagian'|'belum'}
 */
export function getPaymentStatus(totalPaid, annualFee) {
  const paid = Number(totalPaid) || 0;
  const fee = Number(annualFee) || 0;
  if (paid <= 0) return PAYMENT_STATUS.BELUM;
  if (paid >= fee) return PAYMENT_STATUS.LUNAS;
  return PAYMENT_STATUS.SEBAGIAN;
}

/**
 * Ringkasan keuangan seorang siswa.
 * @param {object} student
 * @param {Array<object>} payments - daftar pembayaran milik siswa tsb
 */
export function summarizeStudent(student, payments = []) {
  const annualFee = getAnnualFee(student?.no_induk);
  const monthlyFee = getMonthlyFee(student?.no_induk);
  const studentPayments = payments.filter((p) => p.student_id === student?.id);

  const totalPaid = studentPayments.reduce((sum, p) => sum + (Number(p.nominal_bayar) || 0), 0);
  const remaining = Math.max(annualFee - totalPaid, 0);
  const overpaid = Math.max(totalPaid - annualFee, 0);
  const status = getPaymentStatus(totalPaid, annualFee);

  const paidMonths = [...new Set(studentPayments.map((p) => p.bulan).filter(Boolean))];
  const unpaidMonths = MONTHS.filter((m) => !paidMonths.includes(m));

  return {
    annualFee,
    monthlyFee,
    totalPaid,
    remaining,
    overpaid,
    status,
    progress: annualFee > 0 ? Math.min((totalPaid / annualFee) * 100, 100) : 0,
    payments: studentPayments,
    paidMonths,
    unpaidMonths,
  };
}

/** Keterangan otomatis berdasarkan status pembayaran. */
export function buildKeterangan(totalPaid, annualFee) {
  const status = getPaymentStatus(totalPaid, annualFee);
  const remaining = Math.max(Number(annualFee) - Number(totalPaid), 0);
  if (status === PAYMENT_STATUS.LUNAS) return 'LUNAS';
  if (status === PAYMENT_STATUS.BELUM) return 'Belum ada pembayaran';
  return `Belum Lunas - Sisa ${new Intl.NumberFormat('id-ID').format(remaining)}`;
}
