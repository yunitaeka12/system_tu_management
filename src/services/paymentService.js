/**
 * Service Pembayaran.
 *
 * Seluruh data siswa (nama, NISN, kelas, total tagihan) TIDAK diduplikasi di
 * tabel payments — hanya disimpan `student_id` lalu di-join saat dibaca,
 * persis seperti foreign key di PostgreSQL.
 */
import { getDB, commit } from '../lib/db';
import { uid, normalizeText, currentAcademicYearLabel } from '../utils/helpers';
import {
  MONTHS,
  adjustmentMonths as listAdjustmentMonths,
  billedPeriods,
  currentPeriodStart,
  filterByPeriod,
  getAnnualFee,
  getMonthlyFee,
  getAcademicYearFromNoInduk,
  isOtherPayment,
  periodStartOf,
  summarizeStudent,
  summarizeLastSpp,
  getPaymentStatus,
  PAYMENT_STATUS,
} from '../utils/paymentCalculator';
import { getEkskulIndex } from './ekskulService';
import { getAdjustmentIndex, listStudentAdjustments } from './adjustmentService';

/* ------------------------------------------------------------------ */
/* Tahun ajaran                                                        */
/* ------------------------------------------------------------------ */
/** Rincian tahun ajaran dari label, mis. "2027/2028" → { prefix: "2728", start, end }. */
export function academicYearFromLabel(label) {
  const match = String(label ?? '')
    .trim()
    .match(/^(\d{4})\s*[/\-.\s]?\s*(\d{4})$/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  return {
    prefix: `${String(start).slice(2)}${String(end).slice(2)}`,
    start,
    end,
    label: `${start}/${end}`,
  };
}

function yearRecordFromLabel(label) {
  const info = academicYearFromLabel(label);
  if (!info) return null;
  return {
    id: `ay_${info.prefix}`,
    nama_tahun_ajaran: info.label,
    prefix: info.prefix,
    tahun_mulai: info.start,
    tahun_selesai: info.end,
  };
}

/**
 * Daftar tahun ajaran: gabungan yang tersimpan + yang terdeteksi dari No Induk
 * siswa + tahun berjalan — sehingga tahun ajaran baru otomatis muncul tanpa
 * harus disetel manual.
 */
export function listAcademicYears() {
  const db = getDB();
  const map = new Map();

  (db.academic_years || []).forEach((year) => {
    if (year?.nama_tahun_ajaran) map.set(year.nama_tahun_ajaran, year);
  });

  (db.students || []).forEach((student) => {
    const info = getAcademicYearFromNoInduk(student.no_induk);
    if (info && !map.has(info.label)) {
      map.set(info.label, {
        ...yearRecordFromLabel(info.label),
        status: 'terdeteksi',
        created_at: null,
      });
    }
  });

  const current = currentAcademicYearLabel();
  if (!map.has(current)) {
    map.set(current, { ...yearRecordFromLabel(current), status: 'terdeteksi', created_at: null });
  }

  return [...map.values()].sort((a, b) => (b.tahun_mulai ?? 0) - (a.tahun_mulai ?? 0));
}

/**
 * Pilihan periode tahun ajaran (lama → baru) untuk bulk adjustment.
 * @param {string} noIndukOrPrefix - No Induk / prefix angkatan; kosong berarti
 *   sejak angkatan paling lama yang ada di Buku Induk.
 */
export function listBillingPeriodOptions(noIndukOrPrefix = '') {
  if (noIndukOrPrefix) return billedPeriods(String(noIndukOrPrefix));
  const db = getDB();
  let oldest = currentPeriodStart();
  (db.students || []).forEach((student) => {
    const info = getAcademicYearFromNoInduk(student.no_induk);
    if (info) oldest = Math.min(oldest, info.start);
  });
  return billedPeriods(`${String(oldest).slice(2)}${String(oldest + 1).slice(2)}`);
}

/** Tahun ajaran yang berlaku sekarang (mengikuti tanggal berjalan). */
export function getActiveAcademicYear() {
  const years = listAcademicYears();
  const current = currentAcademicYearLabel();
  return (
    years.find((year) => year.nama_tahun_ajaran === current) ||
    years.find((year) => year.status === 'aktif') ||
    years[0] ||
    null
  );
}


/* ------------------------------------------------------------------ */
/* Query utama                                                         */
/* ------------------------------------------------------------------ */

/**
 * Satu baris tabel pembayaran = siswa + ringkasan keuangannya.
 *
 * Keuangan dihitung untuk **periode tahun ajaran berjalan** (sama seperti
 * halaman Detail Pembayaran), sedangkan kolom “SPP Terakhir” tetap membaca
 * seluruh riwayat.
 */
function buildRow(student, payments, adjustment = null) {
  const summary = summarizeStudent(student, payments, adjustment?.rows || []);
  const academicYear = getAcademicYearFromNoInduk(student.no_induk);
  const lastSpp = summarizeLastSpp(
    summary.payments,
    summary.monthlyFee,
    adjustment?.monthsByYear || null,
  );
  return {
    id: student.id,
    student_id: student.id,
    no_induk: student.no_induk,
    nisn: student.nisn,
    kelas: student.kelas,
    rombel: student.rombel,
    nama_lengkap: student.nama_lengkap,
    tahun_ajaran: academicYear?.label ?? null,
    tahun_ajaran_prefix: academicYear?.prefix ?? null,
    annual_fee: summary.annualFee,
    monthly_fee: getMonthlyFee(student.no_induk),
    total_paid: summary.totalPaid,
    remaining: summary.remaining,
    status: summary.status,
    paid_months: summary.paidMonths,
    payment_count: summary.payments.length,
    last_spp: lastSpp,
    // Nilai datar untuk pengurutan kolom “SPP Terakhir” (tahun × 12 + urutan bulan).
    last_spp_position: lastSpp ? lastSpp.tahun * 12 + MONTHS.indexOf(lastSpp.bulan) : -1,
    adjustment_total: summary.adjustmentTotal,
    last_payment_at: summary.payments.reduce(
      (latest, p) => (!latest || p.created_at > latest ? p.created_at : latest),
      null,
    ),
  };
}

/**
 * Daftar baris pembayaran (menggabungkan siswa + pembayaran).
 * Mendukung search, filter kelas, filter status, dan pagination.
 */
export function listPaymentRows({
  search = '',
  kelas = '',
  status = '',
  tahunAjaran = '',
  page = 1,
  pageSize = 10,
  order = { field: 'nama_lengkap', direction: 'asc' },
} = {}) {
  const db = getDB();
  const students = db.students || [];
  const payments = db.payments || [];
  const keyword = normalizeText(search);
  const digits = String(search || '').replace(/\D/g, '');

  const adjustmentIndex = getAdjustmentIndex();
  let rows = students.map((s) => buildRow(s, payments, adjustmentIndex.get(s.id)));

  if (keyword || digits) {
    rows = rows.filter((row) => {
      const haystack = normalizeText(`${row.nama_lengkap} ${row.kelas} ${row.no_induk}`);
      if (keyword && haystack.includes(keyword)) return true;
      if (digits && (String(row.no_induk).includes(digits) || String(row.nisn || '').includes(digits))) {
        return true;
      }
      return false;
    });
  }

  if (kelas) rows = rows.filter((row) => row.kelas === kelas);
  if (status) rows = rows.filter((row) => row.status === status);
  if (tahunAjaran) rows = rows.filter((row) => row.tahun_ajaran_prefix === tahunAjaran);

  const factor = order.direction === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    const av = a[order.field] ?? '';
    const bv = b[order.field] ?? '';
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
    return String(av).localeCompare(String(bv), 'id', { numeric: true }) * factor;
  });

  const total = rows.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  // Info ekskul hanya dilampirkan untuk baris yang tampil (hemat perhitungan).
  const ekskulIndex = getEkskulIndex();
  const data = rows.slice(start, start + pageSize).map((row) => {
    const ekskul = ekskulIndex.get(row.student_id) || [];
    return {
      ...row,
      ekskul,
      ekskul_names: ekskul.map((item) => item.ekskul_nama),
      ekskul_fee: ekskul.reduce((sum, item) => sum + item.monthlyFee, 0),
      ekskul_paid: ekskul.reduce((sum, item) => sum + item.totalPaid, 0),
    };
  });

  return {
    data,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

/**
 * Ringkasan pembayaran satu siswa + riwayatnya.
 *
 * Tagihan dihitung per **periode tahun ajaran** (Juli–Juni). `periodStart`
 * (tahun mulai, mis. 2025) menentukan periode yang dihitung; bila tidak diisi
 * dipakai periode berjalan.
 */
export function getStudentPaymentSummary(studentId, periodStart = null) {
  const db = getDB();
  const student = (db.students || []).find((s) => s.id === studentId);
  if (!student) return null;
  // Adjustment (pembayaran tercatat di pembukuan sebelumnya) ikut dihitung.
  const summary = summarizeStudent(
    student,
    db.payments || [],
    listStudentAdjustments(studentId),
    Number(periodStart) ? { periodStart: Number(periodStart) } : {},
  );
  return { student, ...summary };
}

/** Riwayat pembayaran siswa, terurut terbaru dahulu. */
export function getStudentPayments(studentId) {
  const db = getDB();
  return (db.payments || [])
    .filter((p) => p.student_id === studentId)
    .sort((a, b) => {
      const monthDiff = MONTHS.indexOf(a.bulan) - MONTHS.indexOf(b.bulan);
      if (monthDiff !== 0) return monthDiff;
      return String(a.created_at).localeCompare(String(b.created_at));
    });
}

/* ------------------------------------------------------------------ */
/* Validasi konflik                                                    */
/* ------------------------------------------------------------------ */

/**
 * Cek apakah bulan tsb sudah punya pembayaran (deteksi double payment).
 * Bila `periodStart` diisi, bulan yang sama pada periode lain tidak dianggap
 * duplikat.
 */
export function checkDuplicateMonth(studentId, bulan, excludePaymentId = null, periodStart = null) {
  const db = getDB();
  const found = (db.payments || []).filter(
    (p) =>
      p.student_id === studentId &&
      p.bulan === bulan &&
      p.id !== excludePaymentId &&
      (periodStart === null ||
        periodStart === undefined ||
        periodStartOf(p.bulan, p.tahun) === Number(periodStart)),
  );
  return {
    hasDuplicate: found.length > 0,
    count: found.length,
    total: found.reduce((sum, p) => sum + (Number(p.nominal_bayar) || 0), 0),
    payments: found,
  };
}

/**
 * Simulasi penambahan pembayaran: menghitung total, sisa, status, serta
 * peringatan (bulan duplikat / kelebihan bayar) tanpa menulis ke database.
 */
export function previewPayment({
  studentId,
  bulan,
  nominal,
  excludePaymentId = null,
  periodStart = null,
}) {
  const db = getDB();
  const student = (db.students || []).find((s) => s.id === studentId);
  if (!student) return null;

  // Total tagihan = seluruh periode yang ditagihkan (periode No Induk →
  // periode berjalan). Tagihan periode lama yang belum dibayar ikut terhitung.
  const periods = billedPeriods(student.no_induk);
  const annualFee = getAnnualFee(student.no_induk) * periods.length;
  const scoped = Number(periodStart) || currentPeriodStart();
  const starts = new Set(periods.map((item) => item.start));
  const currentTotal = (db.payments || [])
    .filter((p) => p.student_id === studentId && p.id !== excludePaymentId)
    .filter((p) => !isOtherPayment(p))
    .filter((p) => starts.has(periodStartOf(p.bulan, p.tahun)))
    .reduce((sum, p) => sum + (Number(p.nominal_bayar) || 0), 0);

  const amount = Number(nominal) || 0;
  const projectedTotal = currentTotal + amount;
  const remaining = annualFee - projectedTotal;

  return {
    annualFee,
    monthlyFee: getMonthlyFee(student.no_induk),
    currentTotal,
    amount,
    projectedTotal,
    remaining,
    overpaid: remaining < 0 ? Math.abs(remaining) : 0,
    status: getPaymentStatus(projectedTotal, annualFee),
    isOverpay: remaining < 0,
    duplicate: checkDuplicateMonth(studentId, bulan, excludePaymentId, scoped),
  };
}

/* ------------------------------------------------------------------ */
/* Mutasi                                                              */
/* ------------------------------------------------------------------ */

export function addPayment({
  studentId,
  bulan,
  tahun,
  nominal,
  tanggalBayar,
  keterangan,
  jenis,
  academicYearId,
  createdBy,
}) {
  const db = getDB();
  const student = (db.students || []).find((s) => s.id === studentId);
  if (!student) return { ok: false, error: 'Siswa tidak ditemukan.' };
  if (!bulan) return { ok: false, error: 'Bulan pembayaran wajib dipilih.' };
  if (!MONTHS.includes(bulan)) return { ok: false, error: 'Bulan pembayaran tidak valid.' };

  const amount = Number(nominal) || 0;
  if (amount <= 0) return { ok: false, error: 'Nominal pembayaran harus lebih dari 0.' };

  const now = new Date().toISOString();
  const payment = {
    id: uid('pay'),
    student_id: studentId,
    bulan,
    tahun: Number(tahun) || new Date().getFullYear(),
    // 'spp' (default) atau 'lain' — pembayaran lain-lain tidak mengurangi SPP.
    jenis: jenis === 'lain' ? 'lain' : 'spp',
    academic_year_id: academicYearId || getActiveAcademicYear()?.id || null,
    nominal_bayar: amount,
    tanggal_bayar: tanggalBayar || now.slice(0, 10),
    keterangan: keterangan || null,
    created_by: createdBy || 'Tata Usaha',
    created_at: now,
    updated_at: now,
  };

  commit((draft) => {
    draft.payments = [...(draft.payments || []), payment];
  });

  return { ok: true, payment };
}

export function updatePayment(id, payload) {
  const db = getDB();
  const current = (db.payments || []).find((p) => p.id === id);
  if (!current) return { ok: false, error: 'Transaksi pembayaran tidak ditemukan.' };

  const amount = payload.nominal !== undefined ? Number(payload.nominal) : current.nominal_bayar;
  if (amount <= 0) return { ok: false, error: 'Nominal pembayaran harus lebih dari 0.' };

  const updated = {
    ...current,
    bulan: payload.bulan ?? current.bulan,
    tahun: payload.tahun !== undefined ? Number(payload.tahun) : current.tahun,
    nominal_bayar: amount,
    tanggal_bayar: payload.tanggalBayar ?? current.tanggal_bayar,
    keterangan: payload.keterangan ?? current.keterangan,
    updated_at: new Date().toISOString(),
  };

  commit((draft) => {
    const index = draft.payments.findIndex((p) => p.id === id);
    if (index >= 0) draft.payments[index] = updated;
  });
  return { ok: true, payment: updated };
}

/** Hapus seluruh riwayat pembayaran satu siswa (data Buku Induk tetap aman). */
export function deleteStudentPayments(studentId) {
  const db = getDB();
  const count = (db.payments || []).filter((p) => p.student_id === studentId).length;
  if (count === 0) return { ok: false, error: 'Belum ada transaksi pembayaran untuk siswa ini.' };

  commit((draft) => {
    draft.payments = (draft.payments || []).filter((p) => p.student_id !== studentId);
  });
  return { ok: true, count };
}

export function deletePayment(id) {
  const exists = (getDB().payments || []).some((p) => p.id === id);
  if (!exists) return { ok: false, error: 'Transaksi pembayaran tidak ditemukan.' };
  commit((draft) => {
    draft.payments = draft.payments.filter((p) => p.id !== id);
  });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Report pembayaran                                                   */
/* ------------------------------------------------------------------ */

/**
 * Data report pembayaran: satu baris per siswa berikut rincian per periode
 * tahun ajaran dan riwayat transaksinya.
 *
 * @param {{ all?: boolean, pageSize?: number }} [params] `all: true`
 *   menampilkan seluruh data (tanpa pagination).
 */
export function getPaymentReport({
  search = '',
  kelas = '',
  tahunAjaran = '',
  status = '',
  page = 1,
  pageSize = 10,
  all = false,
  order = { field: 'nama_lengkap', direction: 'asc' },
} = {}) {
  const db = getDB();
  const adjustments = db.payment_adjustments || [];
  const ekskulIndex = getEkskulIndex();
  const keyword = normalizeText(search);
  const digits = String(search || '').replace(/\D/g, '');

  let rows = (db.students || []).map((student) => {
    const owned = (db.payments || []).filter((p) => p.student_id === student.id);
    const ownedAdjustments = adjustments.filter((a) => a.student_id === student.id);
    const summary = summarizeStudent(student, owned, ownedAdjustments);
    const academicYear = getAcademicYearFromNoInduk(student.no_induk);
    const ekskul = ekskulIndex.get(student.id) || [];

    // Riwayat gabungan: SPP, pembayaran lain-lain, dan adjustment.
    const sppHistory = owned.map((payment) => ({
      key: payment.id,
      kind: isOtherPayment(payment) ? 'lain' : 'spp',
      bulan: payment.bulan,
      tahun: payment.tahun,
      nominal: Number(payment.nominal_bayar) || 0,
      tanggal: payment.tanggal_bayar,
      keterangan: payment.keterangan,
      petugas: payment.created_by,
      raw: payment,
    }));
    const adjustmentHistory = ownedAdjustments.map((row) => ({
      key: row.id,
      kind: 'adjustment',
      bulan: listAdjustmentMonths(row).join(', '),
      tahun: row.tahun,
      nominal: Number(row.nominal) || 0,
      tanggal: row.created_at ? String(row.created_at).slice(0, 10) : null,
      keterangan: row.keterangan,
      petugas: row.created_by,
      raw: row,
    }));
    const ekskulHistory = ekskul.flatMap((enrollment) =>
      (enrollment.payments || []).map((payment) => ({
        key: payment.id,
        kind: 'ekskul',
        ekskul_nama: enrollment.ekskul_nama,
        bulan: payment.bulan,
        tahun: payment.tahun,
        nominal: Number(payment.nominal_bayar) || 0,
        tanggal: payment.tanggal_bayar,
        keterangan: payment.keterangan,
        petugas: payment.created_by,
        raw: payment,
      })),
    );

    return {
      id: student.id,
      student_id: student.id,
      no_induk: student.no_induk,
      nisn: student.nisn,
      nama_lengkap: student.nama_lengkap,
      kelas: student.kelas,
      rombel: student.rombel,
      tahun_ajaran: academicYear?.label ?? null,
      tahun_ajaran_prefix: academicYear?.prefix ?? null,
      ...summary,
      ekskul,
      ekskul_names: ekskul.map((item) => item.ekskul_nama),
      ekskul_paid: ekskul.reduce((sum, item) => sum + item.totalPaid, 0),
      // Periode yang masih ada tunggakan (periode + nominal).
      unpaidPeriods: summary.periodDetails.filter((item) => item.remaining > 0),
      paidPeriods: summary.periodDetails.filter((item) => item.remaining === 0),
      history: [...sppHistory, ...ekskulHistory, ...adjustmentHistory].sort((a, b) =>
        String(b.tanggal ?? '').localeCompare(String(a.tanggal ?? '')),
      ),
      last_payment_at: owned.reduce(
        (latest, p) => (!latest || String(p.created_at) > latest ? String(p.created_at) : latest),
        null,
      ),
    };
  });

  if (keyword || digits) {
    rows = rows.filter((row) => {
      const haystack = normalizeText(`${row.nama_lengkap} ${row.kelas} ${row.no_induk}`);
      if (keyword && haystack.includes(keyword)) return true;
      if (
        digits &&
        (String(row.no_induk).includes(digits) || String(row.nisn || '').includes(digits))
      ) {
        return true;
      }
      return false;
    });
  }
  if (kelas) rows = rows.filter((row) => row.kelas === kelas);
  if (tahunAjaran) rows = rows.filter((row) => row.tahun_ajaran_prefix === tahunAjaran);
  if (status) rows = rows.filter((row) => row.status === status);

  const factor = order.direction === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    const av = a[order.field] ?? '';
    const bv = b[order.field] ?? '';
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
    return String(av).localeCompare(String(bv), 'id', { numeric: true }) * factor;
  });

  const total = rows.length;
  const safeSize = Math.max(Number(pageSize) || 10, 1);
  const totalPages = all ? 1 : Math.max(Math.ceil(total / safeSize), 1);
  const safePage = all ? 1 : Math.min(Math.max(page, 1), totalPages);
  const start = all ? 0 : (safePage - 1) * safeSize;

  return {
    data: all ? rows : rows.slice(start, start + safeSize),
    total,
    page: safePage,
    pageSize: all ? total : safeSize,
    totalPages,
    totals: {
      billing: rows.reduce((sum, row) => sum + row.annualFee, 0),
      paid: rows.reduce((sum, row) => sum + row.totalPaid, 0),
      remaining: rows.reduce((sum, row) => sum + row.remaining, 0),
      studentsWithDues: rows.filter((row) => row.remaining > 0).length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

/** Metrik utama dashboard: tagihan, pembayaran, piutang, status. */
export function getDashboardMetrics() {
  const db = getDB();
  const students = db.students || [];
  const payments = db.payments || [];

  let totalBilling = 0;
  let totalPaid = 0;
  let lunas = 0;
  let sebagian = 0;
  let belum = 0;

  students.forEach((student) => {
    const summary = summarizeStudent(student, payments, db.payment_adjustments || []);
    totalBilling += summary.annualFee;
    totalPaid += summary.totalPaid;
    if (summary.status === PAYMENT_STATUS.LUNAS) lunas += 1;
    else if (summary.status === PAYMENT_STATUS.SEBAGIAN) sebagian += 1;
    else belum += 1;
  });

  const totalPiutang = Math.max(totalBilling - totalPaid, 0);
  const collectionRate = totalBilling > 0 ? (totalPaid / totalBilling) * 100 : 0;

  return {
    totalStudents: students.length,
    totalBilling,
    totalPaid,
    totalPiutang,
    collectionRate,
    lunas,
    sebagian,
    belum,
    studentsWithPayments: new Set(payments.map((p) => p.student_id)).size,
    totalTransactions: payments.length,
    activeYear: getActiveAcademicYear(),
  };
}

/** Data chart pembayaran per bulan (Januari–Desember). */
export function getMonthlyPaymentChart() {
  const db = getDB();
  const payments = db.payments || [];
  return MONTHS.map((bulan) => {
    const items = payments.filter((p) => p.bulan === bulan);
    return {
      bulan,
      short: bulan.slice(0, 3),
      total: items.reduce((sum, p) => sum + (Number(p.nominal_bayar) || 0), 0),
      count: items.length,
    };
  });
}

/** Aktivitas pembayaran terbaru (join dengan siswa). */
export function getRecentPayments(limit = 6) {
  const db = getDB();
  const payments = db.payments || [];
  return [...payments]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit)
    .map((payment) => {
      const student = (db.students || []).find((s) => s.id === payment.student_id);
      return {
        ...payment,
        student_name: student?.nama_lengkap || 'Siswa tidak ditemukan',
        no_induk: student?.no_induk || '-',
        kelas: student?.kelas || '-',
      };
    });
}

/** Insight per kelas untuk dashboard. */
export function getPaymentInsightByClass(limit = 6) {
  const db = getDB();
  const students = db.students || [];
  const payments = db.payments || [];
  const map = new Map();

  students.forEach((student) => {
    const key = student.kelas || 'Tanpa Kelas';
    const summary = summarizeStudent(student, payments, db.payment_adjustments || []);
    if (!map.has(key)) {
      map.set(key, { kelas: key, totalBilling: 0, totalPaid: 0, students: 0 });
    }
    const entry = map.get(key);
    entry.totalBilling += summary.annualFee;
    entry.totalPaid += summary.totalPaid;
    entry.students += 1;
  });

  return [...map.values()]
    .map((entry) => ({
      ...entry,
      remaining: Math.max(entry.totalBilling - entry.totalPaid, 0),
      rate: entry.totalBilling ? (entry.totalPaid / entry.totalBilling) * 100 : 0,
    }))
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, limit);
}

/** Siswa dengan piutang terbesar (untuk tindak lanjut TU). */
export function getTopOutstandingStudents(limit = 5) {
  const db = getDB();
  const payments = db.payments || [];
  return (db.students || [])
    .map((student) => {
      const summary = summarizeStudent(student, payments, db.payment_adjustments || []);
      return {
        id: student.id,
        nama_lengkap: student.nama_lengkap,
        kelas: student.kelas,
        no_induk: student.no_induk,
        annualFee: summary.annualFee,
        totalPaid: summary.totalPaid,
        remaining: summary.remaining,
        status: summary.status,
      };
    })
    .filter((row) => row.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, limit);
}

export { PAYMENT_STATUS, currentAcademicYearLabel };
