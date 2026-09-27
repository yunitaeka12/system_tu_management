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

/**
 * Urutan bulan dalam satu periode tahun ajaran (Juli → Juni).
 *
 * Tagihan sekolah mengikuti tahun ajaran, sehingga peta bulanan dan aliran
 * kelebihan pembayaran dihitung dengan urutan ini — bukan urutan kalender.
 */
export const PERIOD_MONTHS = [
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
];

/** Juli–Desember memakai tahun mulai periode, Januari–Juni tahun berikutnya. */
const PERIOD_FIRST_HALF = PERIOD_MONTHS.slice(0, 6);

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

/* ------------------------------------------------------------------ */
/* Periode tahun ajaran (Juli–Juni)                                    */
/* ------------------------------------------------------------------ */

/** Tanggal awal periode tahun ajaran yang mencakup sebuah tanggal (mulai Juli). */
export function currentPeriodStart(date = new Date()) {
  const month = date.getMonth() + 1;
  return month >= 7 ? date.getFullYear() : date.getFullYear() - 1;
}

/** Data periode tahun ajaran dari tahun mulai: 2025 → "Juli 2025 – Juni 2026". */
export function periodFromStart(start) {
  const value = Number(start);
  if (!Number.isInteger(value)) return null;
  const end = value + 1;
  return {
    start: value,
    end,
    key: `${String(value).slice(2)}${String(end).slice(2)}`,
    label: `${value}/${end}`,
    display: `Juli ${value} – Juni ${end}`,
  };
}

/** Periode tahun ajaran yang berlaku sekarang. */
export function currentPeriod(date = new Date()) {
  return periodFromStart(currentPeriodStart(date));
}

/** Periode tahun ajaran dari No Induk, mis. 25261001 → Juli 2025 – Juni 2026. */
export function periodFromNoInduk(noInduk) {
  const info = getAcademicYearFromNoInduk(noInduk);
  return info ? periodFromStart(info.start) : null;
}

/** Bulan + tahun dalam sebuah periode, urut Juli → Juni. */
export function monthsOfPeriod(periodStart) {
  const start = Number(periodStart);
  if (!Number.isInteger(start)) return [];
  return PERIOD_MONTHS.map((bulan) => {
    const tahun = PERIOD_FIRST_HALF.includes(bulan) ? start : start + 1;
    return { bulan, tahun, label: `${bulan} ${tahun}` };
  });
}

/** Periode tahun ajaran dari sebuah transaksi (nama bulan + tahun kalender). */
export function periodOf(bulan, tahun) {
  const index = PERIOD_MONTHS.indexOf(String(bulan ?? ''));
  const year = Number(tahun);
  if (index < 0 || !Number.isInteger(year) || year < 2000) return null;
  return periodFromStart(index < PERIOD_FIRST_HALF.length ? year : year - 1);
}

/** Tahun mulai periode sebuah transaksi (null bila datanya tidak lengkap). */
export function periodStartOf(bulan, tahun) {
  return periodOf(bulan, tahun)?.start ?? null;
}

/**
 * Daftar periode tahun ajaran milik seorang siswa: sejak periode No Induk
 * sampai periode berjalan, ditambah periode yang punya transaksi — terbaru
 * lebih dahulu. Contoh No Induk 2526 pada September 2026:
 *   "Juli 2026 – Juni 2027", "Juli 2025 – Juni 2026"
 */
export function listStudentPeriods(noInduk, transactions = [], date = new Date()) {
  const starts = new Set([currentPeriodStart(date)]);
  const intake = periodFromNoInduk(noInduk);
  if (intake) starts.add(intake.start);
  transactions.forEach((item) => {
    const start = periodStartOf(item?.bulan, item?.tahun);
    if (start !== null) starts.add(start);
  });

  const min = Math.min(...starts);
  const max = Math.max(...starts);
  const list = [];
  for (let start = min; start <= max; start += 1) list.push(periodFromStart(start));
  return list.sort((a, b) => b.start - a.start);
}

/** Saring transaksi yang masuk sebuah periode tahun ajaran. */
export function filterByPeriod(items = [], periodStart) {
  if (periodStart === null || periodStart === undefined || periodStart === '') return items;
  const start = Number(periodStart);
  return items.filter((item) => periodStartOf(item?.bulan, item?.tahun) === start);
}

/** Nama bulan dari sebuah adjustment (kolom jsonb bisa array atau string). */
export function adjustmentMonths(row) {
  const raw = row?.bulan;
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  return list
    .map((item) => String(item ?? '').trim())
    .filter((item) => MONTHS.includes(item));
}

/** Tahun mulai periode sebuah adjustment (disimpan pada kolom `tahun`). */
export function adjustmentPeriodStart(row) {
  const start = Number(row?.tahun);
  return Number.isInteger(start) && start > 2000 ? start : null;
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
 * Pembayaran “lain-lain” (bukan SPP) — mis. seragam, uang kegiatan.
 * Tidak mengurangi tagihan SPP, hanya tercatat di peta bulanan & riwayat.
 */
export function isOtherPayment(payment) {
  return payment?.jenis === 'lain';
}

/**
 * Daftar periode yang ditagihkan: sejak periode No Induk sampai periode
 * berjalan (urut lama → baru). Contoh No Induk 2526 pada September 2026:
 *   [Juli 2025 – Juni 2026, Juli 2026 – Juni 2027]
 */
export function billedPeriods(noInduk, date = new Date()) {
  const current = currentPeriodStart(date);
  const intake = periodFromNoInduk(noInduk);
  const start = intake ? Math.min(intake.start, current) : current;
  const list = [];
  for (let year = start; year <= current; year += 1) list.push(periodFromStart(year));
  return list;
}

/**
 * Ringkasan keuangan seorang siswa untuk **seluruh periode yang ditagihkan**
 * (periode No Induk → periode berjalan). Pembayaran “lain-lain” tidak ikut
 * mengurangi tagihan SPP.
 *
 * @param {object} student
 * @param {Array<object>} payments - seluruh pembayaran siswa
 * @param {Array<object>} adjustments - seluruh adjustment siswa
 * @param {{ periods?: Array<object>, periodStart?: number }} [options]
 *   `periods`/`periodStart` membatasi perhitungan ke periode tertentu
 *   (default: seluruh periode yang ditagihkan).
 */
export function summarizeStudent(student, payments = [], adjustments = [], options = {}) {
  const monthlyFee = getMonthlyFee(student?.no_induk);
  const feePerPeriod = getAnnualFee(student?.no_induk);
  const studentPayments = payments.filter((p) => p.student_id === student?.id);
  const studentAdjustments = adjustments.filter((a) => a.student_id === student?.id);

  const periods =
    Array.isArray(options.periods) && options.periods.length > 0
      ? [...options.periods].sort((a, b) => a.start - b.start)
      : Number.isInteger(options.periodStart)
        ? [periodFromStart(options.periodStart)]
        : billedPeriods(student?.no_induk);
  const starts = new Set(periods.map((p) => p.start));
  const inPeriod = (item) => starts.has(periodStartOf(item?.bulan, item?.tahun));

  const billedAll = studentPayments.filter(inPeriod);
  // Hanya pembayaran SPP yang dihitung sebagai pelunasan tagihan.
  const billedPayments = billedAll.filter((p) => !isOtherPayment(p));
  const billedOtherPayments = billedAll.filter(isOtherPayment);
  const billedAdjustments = studentAdjustments.filter((row) =>
    starts.has(adjustmentPeriodStart(row)),
  );

  // Rincian per periode: bulan-bulan yang belum lunas + nominalnya.
  const periodDetails = periods.map((period) => {
    const periodPayments = billedPayments.filter(
      (p) => periodStartOf(p.bulan, p.tahun) === period.start,
    );
    const periodAdjustments = billedAdjustments.filter(
      (row) => adjustmentPeriodStart(row) === period.start,
    );
    const adjusted = PERIOD_MONTHS.filter((month) =>
      periodAdjustments.some((row) => adjustmentMonths(row).includes(month)),
    );
    const coverage = buildMonthlyCoverage(periodPayments, monthlyFee, null, adjusted, {
      monthOrder: PERIOD_MONTHS,
    });
    const months = monthsOfPeriod(period.start);

    const paid =
      periodPayments.reduce((sum, p) => sum + (Number(p.nominal_bayar) || 0), 0) +
      periodAdjustments.reduce((sum, row) => sum + (Number(row.nominal) || 0), 0);
    const covered = coverage.reduce((sum, row) => sum + row.covered, 0);
    const dues = coverage
      .map((row, index) => ({
        bulan: row.bulan,
        tahun: months[index]?.tahun ?? null,
        nominal: row.shortfall,
      }))
      .filter((row) => row.nominal > 0);

    return {
      period,
      billed: feePerPeriod,
      paid,
      covered,
      remaining: Math.max(feePerPeriod - covered, 0),
      overpaid: Math.max(paid - feePerPeriod, 0),
      status: getPaymentStatus(paid, feePerPeriod),
      dues,
      adjustedMonths: adjusted,
      paidMonths: PERIOD_MONTHS.filter((month) => {
        const row = coverage.find((item) => item.bulan === month);
        return row ? row.isFull : false;
      }),
    };
  });

  const annualFee = feePerPeriod * periods.length;
  const paidFromLedger = billedPayments.reduce(
    (sum, p) => sum + (Number(p.nominal_bayar) || 0),
    0,
  );
  const adjustmentTotal = billedAdjustments.reduce(
    (sum, row) => sum + (Number(row.nominal) || 0),
    0,
  );
  const totalPaid = paidFromLedger + adjustmentTotal;
  const remaining = periodDetails.reduce((sum, item) => sum + item.remaining, 0);
  const overpaid = periodDetails.reduce((sum, item) => sum + item.overpaid, 0);
  const status = getPaymentStatus(totalPaid, annualFee);
  const paidMonths = periodDetails.flatMap((item) => item.paidMonths);
  const totalMonths = periods.length * MONTHS_IN_YEAR;
  const dues = periodDetails.flatMap((item) => item.dues);

  const first = periods[0] ?? null;
  const last = periods[periods.length - 1] ?? null;

  return {
    annualFee,
    feePerPeriod,
    monthlyFee,
    totalPaid,
    paidFromLedger,
    adjustmentTotal,
    remaining,
    overpaid,
    status,
    progress: annualFee > 0 ? Math.min((totalPaid / annualFee) * 100, 100) : 0,
    // Seluruh riwayat siswa — dipakai tabel & peta bulanan (bisa lintas periode).
    payments: studentPayments,
    adjustments: studentAdjustments,
    // Transaksi pada periode yang ditagihkan.
    billedPayments,
    billedOtherPayments,
    billedAdjustments,
    otherTotal: billedOtherPayments.reduce(
      (sum, p) => sum + (Number(p.nominal_bayar) || 0),
      0,
    ),
    periods,
    periodDetails,
    // Periode terakhir (periode berjalan) + rentang periode yang ditagihkan.
    period: last,
    periodRange:
      first && last
        ? first.start === last.start
          ? first.display
          : `${first.display} s/d ${last.display}`
        : null,
    totalMonths,
    paidMonthCount: paidMonths.length,
    paidMonths,
    unpaidMonthCount: Math.max(totalMonths - paidMonths.length, 0),
    dues,
  };
}

/** Tahun sebuah transaksi (fallback: tahun berjalan). */
export function getPaymentYear(payment) {
  const year = Number(payment?.tahun);
  return Number.isInteger(year) && year > 2000 ? year : new Date().getFullYear();
}

/**
 * Periode yang dipakai sebagai acuan tagihan tahun ajaran berjalan.
 * Tahun ajaran selalu dimulai bulan Juli.
 */
export function billedPeriod(date = new Date()) {
  return periodFromStart(currentPeriodStart(date));
}

/**
 * Sebar pembayaran SPP ke bulan-bulan secara berurutan (waterfall):
 * kelebihan bayar pada satu bulan otomatis menutup bulan berikutnya.
 *
 * @param {Array<object>} payments - transaksi SPP siswa
 * @param {number} monthlyFee - tagihan bulanan
 * @param {{bulan: string, nominal: number}|null} extra - pembayaran tambahan (opsional)
 * @param {string[]} adjustedMonths - bulan yang lunas karena adjustment (opsional)
 * @param {{monthOrder?: string[]}} [options] - urutan bulan yang dipakai
 *   (default Januari–Desember; kirim PERIOD_MONTHS untuk tahun ajaran)
 * @returns {Array<{bulan, paid, carryIn, covered, carryOut, shortfall, isFull, adjusted}>}
 */
export function buildMonthlyCoverage(
  payments = [],
  monthlyFee = 0,
  extra = null,
  adjustedMonths = [],
  options = {},
) {
  const fee = Number(monthlyFee) || 0;
  const order =
    Array.isArray(options.monthOrder) && options.monthOrder.length > 0
      ? options.monthOrder
      : MONTHS;
  const adjusted = new Set(adjustedMonths || []);
  const tagged = new Map();
  payments.forEach((payment) => {
    tagged.set(
      payment.bulan,
      (tagged.get(payment.bulan) ?? 0) + (Number(payment.nominal_bayar) || 0),
    );
  });
  if (extra?.bulan) {
    tagged.set(extra.bulan, (tagged.get(extra.bulan) ?? 0) + (Number(extra.nominal) || 0));
  }

  let carry = 0;
  return order.map((month) => {
    const paid = tagged.get(month) ?? 0;
    const available = carry + paid;
    const covered = fee > 0 ? Math.min(available, fee) : available;
    const carryOut = Math.max(available - fee, 0);
    // Bulan yang di-adjustment dianggap lunas penuh, sedangkan kelebihan bayar
    // asli tetap mengalir ke bulan berikutnya.
    const isAdjusted = adjusted.has(month);
    const row = {
      bulan: month,
      paid,
      carryIn: available - paid,
      covered: isAdjusted && fee > 0 ? fee : covered,
      carryOut,
      shortfall: isAdjusted ? 0 : Math.max(fee - covered, 0),
      isFull: isAdjusted ? true : fee > 0 ? available >= fee : available > 0,
      adjusted: isAdjusted,
    };
    carry = carryOut;
    return row;
  });
}

/**
 * Ringkasan pembayaran SPP terakhir seorang siswa — untuk kolom “SPP Terakhir”.
 *
 * Yang dibaca adalah tahun pembayaran terakhir yang punya transaksi, lalu bulan
 * terakhir (urut kalender sekolah) yang dibayar pada tahun itu. Kelunasannya
 * dinilai dengan waterfall yang sama seperti peta bulanan, sehingga kelebihan
 * bayar bulan sebelumnya ikut menutup bulan setelahnya.
 *
 * @param {Array<object>} payments - transaksi SPP siswa
 * @param {number} monthlyFee - tagihan bulanan
 * @param {Map<number, Set<string>>} adjustedMonthsByYear - bulan lunas per tahun
 *   karena adjustment (opsional, dari getAdjustmentIndex)
 * @returns {{
 *   bulan: string, tahun: number, paid: number, isFull: boolean, adjusted: boolean,
 *   shortfall: number, coveredThrough: string, extraMonths: number
 * }|null} null bila belum ada pembayaran / adjustment sama sekali
 */
export function summarizeLastSpp(payments = [], monthlyFee = 0, adjustedMonthsByYear = null) {
  const list = (payments || []).filter(
    (payment) => MONTHS.includes(payment?.bulan) && !isOtherPayment(payment),
  );
  const byYear = adjustedMonthsByYear instanceof Map ? adjustedMonthsByYear : new Map();
  const years = [...list.map(getPaymentYear), ...byYear.keys()];
  if (years.length === 0) return null;

  const tahun = Math.max(...years);
  const rawMonths = byYear.get(tahun);
  const adjustedSet = rawMonths instanceof Set ? rawMonths : new Set(rawMonths || []);
  const coverage = buildMonthlyCoverage(
    list.filter((payment) => getPaymentYear(payment) === tahun),
    monthlyFee,
    null,
    MONTHS.filter((month) => adjustedSet.has(month)),
  );

  // Bulan terakhir yang sudah dibayar / ditutup adjustment — bukan bulan
  // terakhir yang lunas.
  let lastPaidIndex = -1;
  coverage.forEach((row, index) => {
    if (row.paid > 0 || row.adjusted) lastPaidIndex = index;
  });
  if (lastPaidIndex < 0) return null;

  // Uang di bulan itu bisa menutup bulan-bulan berikutnya (waterfall).
  let coveredIndex = lastPaidIndex;
  coverage.forEach((row, index) => {
    if (row.isFull) coveredIndex = Math.max(coveredIndex, index);
  });

  const row = coverage[lastPaidIndex];
  return {
    bulan: row.bulan,
    tahun,
    paid: row.paid,
    isFull: row.isFull,
    adjusted: Boolean(row.adjusted),
    shortfall: row.shortfall,
    coveredThrough: coverage[coveredIndex]?.bulan ?? row.bulan,
    extraMonths: Math.max(coveredIndex - lastPaidIndex, 0),
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
