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
  getAnnualFee,
  getMonthlyFee,
  getAcademicYearFromNoInduk,
  summarizeStudent,
  getPaymentStatus,
  PAYMENT_STATUS,
} from '../utils/paymentCalculator';
import { getEkskulIndex } from './ekskulService';

/* ------------------------------------------------------------------ */
/* Tahun ajaran                                                        */
/* ------------------------------------------------------------------ */
export function listAcademicYears() {
  return getDB().academic_years || [];
}

export function getActiveAcademicYear() {
  const years = listAcademicYears();
  return years.find((y) => y.status === 'aktif') || years[0] || null;
}

/* ------------------------------------------------------------------ */
/* Query utama                                                         */
/* ------------------------------------------------------------------ */

/** Satu baris tabel pembayaran = siswa + ringkasan keuangannya. */
function buildRow(student, payments) {
  const summary = summarizeStudent(student, payments);
  const academicYear = getAcademicYearFromNoInduk(student.no_induk);
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

  let rows = students.map((s) => buildRow(s, payments));

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

/** Ringkasan pembayaran satu siswa + riwayatnya. */
export function getStudentPaymentSummary(studentId) {
  const db = getDB();
  const student = (db.students || []).find((s) => s.id === studentId);
  if (!student) return null;
  const summary = summarizeStudent(student, db.payments || []);
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

/** Cek apakah bulan tsb sudah punya pembayaran (deteksi double payment). */
export function checkDuplicateMonth(studentId, bulan, excludePaymentId = null) {
  const db = getDB();
  const found = (db.payments || []).filter(
    (p) =>
      p.student_id === studentId &&
      p.bulan === bulan &&
      p.id !== excludePaymentId,
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
export function previewPayment({ studentId, bulan, nominal, excludePaymentId = null }) {
  const db = getDB();
  const student = (db.students || []).find((s) => s.id === studentId);
  if (!student) return null;

  const annualFee = getAnnualFee(student.no_induk);
  const currentTotal = (db.payments || [])
    .filter((p) => p.student_id === studentId && p.id !== excludePaymentId)
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
    duplicate: checkDuplicateMonth(studentId, bulan, excludePaymentId),
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
    const summary = summarizeStudent(student, payments);
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
    const summary = summarizeStudent(student, payments);
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
      const summary = summarizeStudent(student, payments);
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
