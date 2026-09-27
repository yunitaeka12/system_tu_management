/**
 * Service Adjustment / potongan tagihan SPP.
 *
 * Dipakai untuk pembayaran yang **sudah tercatat di pembukuan sebelumnya**
 * (di luar aplikasi) sehingga tidak perlu dicatat ulang sebagai transaksi.
 *
 * Cara kerjanya:
 *  - `nominal` dihitung sebagai sudah dibayar (mengurangi sisa tagihan).
 *  - bulan yang dicentang (`bulan`) otomatis dianggap lunas pada Peta
 *    Pembayaran Bulanan — hijau penuh tanpa transaksi.
 *
 * Setiap adjustment terikat pada satu **periode tahun ajaran** (Juli–Juni):
 * kolom `tahun` menyimpan tahun mulai periode tersebut, mis. 2025 untuk
 * "Juli 2025 – Juni 2026". Jadi setiap periode bisa punya adjustment sendiri.
 */
import { getDB, commit } from '../lib/db';
import { uid } from '../utils/helpers';
import {
  MONTHS,
  PERIOD_MONTHS,
  adjustmentMonths,
  adjustmentPeriodStart,
  currentPeriodStart,
  getAcademicYearFromNoInduk,
  getMonthlyFee,
  monthsOfPeriod,
  periodFromStart,
} from '../utils/paymentCalculator';

/** Keterangan bawaan untuk adjustment yang dibuat massal dari Admin Panel. */
export const DEFAULT_BULK_NOTE = 'Sudah bayar dan tercatat di pembukuan sebelumnya';

/** Bulan tersimpan bisa berupa array (jsonb), string, atau null. */
export const monthsOf = adjustmentMonths;

/** Tahun mulai periode sebuah adjustment (fallback: periode berjalan). */
export function adjustmentPeriod(row) {
  return adjustmentPeriodStart(row) ?? currentPeriodStart();
}

export { adjustmentPeriodStart };

/** Seluruh adjustment milik satu siswa, terbaru lebih dulu. */
export function listStudentAdjustments(studentId) {
  return (getDB().payment_adjustments || [])
    .filter((row) => row.student_id === studentId)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

/**
 * Index adjustment per siswa (dibuat sekali lalu dipakai berulang):
 * - `total`          : total nominal adjustment seluruh periode
 * - `rows`           : baris adjustment siswa tsb
 * - `monthsByPeriod` : Map<tahun mulai periode, Set<bulan>>
 * - `monthsByYear`   : Map<tahun kalender, Set<bulan>> — dipakai perhitungan
 *                      “SPP Terakhir” yang memakai tahun kalender transaksi.
 */
export function getAdjustmentIndex() {
  const map = new Map();
  (getDB().payment_adjustments || []).forEach((row) => {
    const key = row.student_id;
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        total: 0,
        rows: [],
        monthsByPeriod: new Map(),
        monthsByYear: new Map(),
        periods: new Set(),
      });
    }
    const entry = map.get(key);
    const start = adjustmentPeriod(row);
    entry.total += Number(row.nominal) || 0;
    entry.rows.push(row);
    entry.periods.add(start);
    if (!entry.monthsByPeriod.has(start)) entry.monthsByPeriod.set(start, new Set());

    const periodMonths = monthsOfPeriod(start);
    monthsOf(row).forEach((month) => {
      entry.monthsByPeriod.get(start).add(month);
      const year = periodMonths.find((item) => item.bulan === month)?.tahun ?? start;
      if (!entry.monthsByYear.has(year)) entry.monthsByYear.set(year, new Set());
      entry.monthsByYear.get(year).add(month);
    });
  });
  return map;
}

/** Total nominal adjustment satu siswa (seluruh periode). */
export function totalAdjustment(studentId) {
  return (getDB().payment_adjustments || [])
    .filter((row) => row.student_id === studentId)
    .reduce((sum, row) => sum + (Number(row.nominal) || 0), 0);
}

/**
 * Daftar bulan yang dianggap lunas karena adjustment pada periode tertentu.
 * @param {string} studentId
 * @param {number} periodStart - tahun mulai periode (default: periode berjalan)
 * @returns {string[]} nama bulan (urut Juli → Juni)
 */
export function adjustedMonths(studentId, periodStart = currentPeriodStart()) {
  const found = new Set();
  listStudentAdjustments(studentId).forEach((row) => {
    if (adjustmentPeriod(row) !== Number(periodStart)) return;
    monthsOf(row).forEach((month) => found.add(month));
  });
  return MONTHS.filter((month) => found.has(month));
}

/** Validasi bersama untuk tambah/ubah adjustment. */
function validate({ nominal, bulan }) {
  const amount = Number(nominal) || 0;
  if (amount <= 0) return { ok: false, error: 'Total adjustment harus lebih dari 0.' };
  const months = Array.isArray(bulan) ? bulan.filter((m) => MONTHS.includes(m)) : [];
  if (months.length === 0) {
    return { ok: false, error: 'Pilih minimal satu bulan yang dicentang.' };
  }
  return { ok: true, amount, months };
}

export function addAdjustment({
  studentId,
  nominal,
  bulan,
  tahun,
  keterangan,
  createdBy,
}) {
  const db = getDB();
  const student = (db.students || []).find((item) => item.id === studentId);
  if (!student) return { ok: false, error: 'Siswa tidak ditemukan.' };

  const checked = validate({ nominal, bulan });
  if (!checked.ok) return checked;

  const now = new Date().toISOString();
  const row = {
    id: uid('adj'),
    student_id: studentId,
    // Kolom `tahun` = tahun mulai periode tahun ajaran (bukan tahun kalender).
    tahun: Number(tahun) || currentPeriodStart(),
    nominal: checked.amount,
    bulan: checked.months,
    keterangan: String(keterangan || '').trim() || null,
    created_by: createdBy || 'Tata Usaha',
    created_at: now,
    updated_at: now,
  };

  commit((draft) => {
    draft.payment_adjustments = [...(draft.payment_adjustments || []), row];
  });

  return { ok: true, adjustment: row };
}

export function updateAdjustment(id, payload) {
  const current = (getDB().payment_adjustments || []).find((row) => row.id === id);
  if (!current) return { ok: false, error: 'Data adjustment tidak ditemukan.' };

  const checked = validate({
    nominal: payload.nominal ?? current.nominal,
    bulan: payload.bulan ?? monthsOf(current),
  });
  if (!checked.ok) return checked;

  const updated = {
    ...current,
    tahun: payload.tahun !== undefined ? Number(payload.tahun) : adjustmentPeriod(current),
    nominal: checked.amount,
    bulan: checked.months,
    keterangan:
      payload.keterangan !== undefined
        ? String(payload.keterangan || '').trim() || null
        : current.keterangan,
    updated_at: new Date().toISOString(),
  };

  commit((draft) => {
    const index = (draft.payment_adjustments || []).findIndex((row) => row.id === id);
    if (index >= 0) draft.payment_adjustments[index] = updated;
  });

  return { ok: true, adjustment: updated };
}

export function deleteAdjustment(id) {
  const exists = (getDB().payment_adjustments || []).some((row) => row.id === id);
  if (!exists) return { ok: false, error: 'Data adjustment tidak ditemukan.' };

  commit((draft) => {
    draft.payment_adjustments = (draft.payment_adjustments || []).filter((row) => row.id !== id);
  });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Bulk adjust (Admin Panel)                                           */
/* ------------------------------------------------------------------ */

/** Siswa yang cocok dengan kriteria bulk adjust. */
function bulkTargets({ tahunAjaran = '', kelas = '' } = {}) {
  return (getDB().students || []).filter((student) => {
    if (
      tahunAjaran &&
      getAcademicYearFromNoInduk(student.no_induk)?.prefix !== tahunAjaran
    ) {
      return false;
    }
    if (kelas && student.kelas !== kelas) return false;
    return true;
  });
}

/** Rencana adjustment untuk satu siswa: gabung bulan dari data yang ada. */
function planFor(student, periodStart, months, keterangan, createdBy) {
  const existing = (getDB().payment_adjustments || []).find(
    (row) => row.student_id === student.id && adjustmentPeriod(row) === Number(periodStart),
  );
  const union = existing
    ? PERIOD_MONTHS.filter(
        (month) => months.includes(month) || monthsOf(existing).includes(month),
      )
    : months;
  const nominal = getMonthlyFee(student.no_induk) * union.length;
  const now = new Date().toISOString();
  const row = {
    id: existing?.id ?? uid('adj'),
    student_id: student.id,
    tahun: Number(periodStart),
    nominal,
    bulan: union,
    keterangan: keterangan ?? existing?.keterangan ?? null,
    created_by: existing?.created_by ?? createdBy,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  return { row, isUpdate: Boolean(existing), months: union.length, nominal };
}

/**
 * Pratinjau bulk adjust: berapa siswa terdampak dan berapa total tagihan yang
 * berkurang, tanpa menulis ke database.
 */
export function previewBulkAdjust({ tahunAjaran = '', kelas = '', periodStart, months = [] } = {}) {
  const list = PERIOD_MONTHS.filter((month) => months.includes(month));
  const targets = bulkTargets({ tahunAjaran, kelas });
  const plans = targets.map((student) =>
    planFor(student, periodStart, list, null, null),
  );
  return {
    period: periodFromStart(periodStart),
    months: list,
    students: targets.length,
    willUpdate: plans.filter((plan) => plan.isUpdate).length,
    willCreate: plans.filter((plan) => !plan.isUpdate).length,
    total: plans.reduce((sum, plan) => sum + plan.nominal, 0),
    sample: targets.slice(0, 5).map((student) => student.nama_lengkap),
  };
}

/**
 * Terapkan adjustment massal: bulan yang dipilih dianggap lunas untuk semua
 * siswa yang cocok, sehingga tagihan periode tersebut otomatis berkurang.
 * Nominal dihitung otomatis (jumlah bulan × tarif SPP angkatan siswa).
 */
export function bulkAdjust({
  tahunAjaran = '',
  kelas = '',
  periodStart,
  months = [],
  keterangan,
  createdBy,
} = {}) {
  if (!Number(periodStart)) {
    return { ok: false, error: 'Pilih periode tahun ajaran terlebih dahulu.' };
  }
  const list = PERIOD_MONTHS.filter((month) => months.includes(month));
  if (list.length === 0) return { ok: false, error: 'Pilih minimal satu bulan.' };
  if (!tahunAjaran && !kelas) {
    return { ok: false, error: 'Pilih minimal satu kriteria (tahun ajaran atau kelas).' };
  }

  const targets = bulkTargets({ tahunAjaran, kelas });
  if (targets.length === 0) {
    return { ok: false, error: 'Tidak ada siswa yang cocok dengan kriteria tersebut.' };
  }

  const note = String(keterangan || '').trim() || DEFAULT_BULK_NOTE;
  let created = 0;
  let updated = 0;
  let total = 0;
  const rows = targets.map((student) => {
    const plan = planFor(student, periodStart, list, note, createdBy || 'Administrator');
    if (plan.isUpdate) updated += 1;
    else created += 1;
    total += plan.nominal;
    return plan.row;
  });

  commit((draft) => {
    const replaced = new Map(rows.map((row) => [row.id, row]));
    const others = (draft.payment_adjustments || []).filter((row) => !replaced.has(row.id));
    draft.payment_adjustments = [...others, ...rows];
  });

  return { ok: true, students: rows.length, created, updated, total };
}

/** Hapus seluruh adjustment satu siswa (dipakai saat menghapus riwayat). */
export function deleteStudentAdjustments(studentId) {
  const count = (getDB().payment_adjustments || []).filter(
    (row) => row.student_id === studentId,
  ).length;
  if (count === 0) return { ok: false, count: 0 };

  commit((draft) => {
    draft.payment_adjustments = (draft.payment_adjustments || []).filter(
      (row) => row.student_id !== studentId,
    );
  });
  return { ok: true, count };
}
