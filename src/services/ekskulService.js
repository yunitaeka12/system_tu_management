/**
 * Service Ekskul.
 *
 * Satu siswa dapat mengikuti lebih dari satu ekskul. Setiap pendaftaran
 * (`student_ekskul`) memiliki biaya bulanan sendiri, dan pembayarannya
 * dicatat per periode bulan pada tabel `ekskul_payments`.
 *
 * Berbeda dengan SPP, ekskul TIDAK punya total tagihan tahunan
 * (tidak dikalikan 12 bulan) — hanya tagihan bulanan per ekskul.
 */
import { getDB, commit } from '../lib/db';
import { uid, normalizeText } from '../utils/helpers';
import {
  DEFAULT_EKSKUL_FEE,
  ekskulFeeByName,
  getEkskulOptions as getEkskulOptionsFromSettings,
} from './settingsService';

export { DEFAULT_EKSKUL_FEE };
import {
  MONTHS,
  currentPeriodStart,
  getAcademicYearFromNoInduk,
  getAcademicYearLabelFromNoInduk,
  monthsOfPeriod,
  periodStartOf,
} from '../utils/paymentCalculator';

/**
 * Tahun pembayaran ekskul: bulan Januari–Juni masuk tahun berikutnya, mengikuti
 * periode tahun ajaran berjalan (mulai Juli).
 */
function paymentYearFor(bulan, periodStart = currentPeriodStart()) {
  const found = monthsOfPeriod(periodStart).find((item) => item.bulan === bulan);
  return found?.tahun ?? new Date().getFullYear();
}

/**
 * Daftar ekskul beserta biaya bulanannya — diambil dari menu Pengaturan
 * (lihat settingsService) sehingga bisa diubah Administrator.
 */
export function getEkskulOptions() {
  return getEkskulOptionsFromSettings();
}

/** Cari biaya bulanan berdasarkan nama ekskul (case-insensitive). */
export function getEkskulFee(nama) {
  return ekskulFeeByName(nama);
}

const nowISO = () => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* Query                                                               */
/* ------------------------------------------------------------------ */
function enrollmentsOf(studentId) {
  const db = getDB();
  return (db.student_ekskul || []).filter(
    (row) => row.student_id === studentId && row.status !== 'nonaktif',
  );
}

function paymentsOf(enrollmentId) {
  return (getDB().ekskul_payments || []).filter(
    (row) => row.student_ekskul_id === enrollmentId,
  );
}

function summarizeEnrollment(enrollment) {
  const payments = paymentsOf(enrollment.id).sort((a, b) => {
    const diff = MONTHS.indexOf(a.bulan) - MONTHS.indexOf(b.bulan);
    if (diff !== 0) return diff;
    return String(a.created_at).localeCompare(String(b.created_at));
  });
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.nominal_bayar) || 0), 0);
  const monthlyFee = Number(enrollment.biaya_bulanan) || getEkskulFee(enrollment.ekskul_nama);
  const paidMonths = [...new Set(payments.map((p) => p.bulan).filter(Boolean))];

  return {
    ...enrollment,
    monthlyFee,
    payments,
    totalPaid,
    paidMonths,
    transactionCount: payments.length,
  };
}

/** Baris tabel Ekskul: siswa + daftar ekskul yang diikuti. */
export function listEkskulRows({
  search = '',
  kelas = '',
  tahunAjaran = '',
  page = 1,
  pageSize = 10,
  order = { field: 'nama_lengkap', direction: 'asc' },
} = {}) {
  const db = getDB();
  const students = db.students || [];
  const keyword = normalizeText(search);
  const digits = String(search || '').replace(/\D/g, '');

  let rows = students.map((student) => {
    const enrollments = enrollmentsOf(student.id).map(summarizeEnrollment);
    return {
      id: student.id,
      student_id: student.id,
      no_induk: student.no_induk,
      nisn: student.nisn,
      nama_lengkap: student.nama_lengkap,
      kelas: student.kelas,
      rombel: student.rombel,
      tahun_ajaran: getAcademicYearFromNoInduk(student.no_induk)?.label ?? null,
      tahun_ajaran_prefix: getAcademicYearFromNoInduk(student.no_induk)?.prefix ?? null,
      ekskul: enrollments,
      ekskul_names: enrollments.map((item) => item.ekskul_nama),
      ekskul_fee: enrollments.reduce((sum, item) => sum + item.monthlyFee, 0),
      ekskul_paid: enrollments.reduce((sum, item) => sum + item.totalPaid, 0),
      ekskul_transactions: enrollments.reduce((sum, item) => sum + item.transactionCount, 0),
    };
  });

  if (keyword || digits) {
    rows = rows.filter((row) => {
      const haystack = normalizeText(
        `${row.nama_lengkap} ${row.kelas} ${row.no_induk} ${row.ekskul_names.join(' ')}`,
      );
      if (keyword && haystack.includes(keyword)) return true;
      if (digits && (String(row.no_induk).includes(digits) || String(row.nisn || '').includes(digits))) {
        return true;
      }
      return false;
    });
  }

  if (kelas) rows = rows.filter((row) => row.kelas === kelas);
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

  return {
    data: rows.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

/**
 * Indeks ekskul per siswa (student_id → daftar pendaftaran aktif + ringkasannya).
 * Dipakai modul Pembayaran agar tidak menghitung ulang untuk tiap baris tabel.
 */
export function getEkskulIndex() {
  const map = new Map();
  (getDB().student_ekskul || []).forEach((row) => {
    if (row.status === 'nonaktif') return;
    if (!map.has(row.student_id)) map.set(row.student_id, []);
    map.get(row.student_id).push(summarizeEnrollment(row));
  });
  // Urutkan pendaftaran terlama → terbaru (riwayat per tanggal).
  map.forEach((list) =>
    list.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
  );
  return map;
}

/** Detail ekskul satu siswa. */
export function getStudentEkskul(studentId) {
  const db = getDB();
  const student = (db.students || []).find((s) => s.id === studentId);
  if (!student) return null;

  const enrollments = enrollmentsOf(studentId).map(summarizeEnrollment);

  return {
    student,
    enrollments,
    totalFee: enrollments.reduce((sum, item) => sum + item.monthlyFee, 0),
    totalPaid: enrollments.reduce((sum, item) => sum + item.totalPaid, 0),
    getEnrollment: (enrollmentId) =>
      enrollments.find((item) => item.id === enrollmentId) || null,
  };
}

/** Statistik ringkas modul ekskul. */
export function getEkskulStats() {
  const db = getDB();
  const enrollments = db.student_ekskul || [];
  const payments = db.ekskul_payments || [];
  const byEkskul = {};

  enrollments.forEach((row) => {
    const key = row.ekskul_nama || 'Lainnya';
    byEkskul[key] = (byEkskul[key] || 0) + 1;
  });

  return {
    participants: new Set(enrollments.map((row) => row.student_id)).size,
    enrollments: enrollments.length,
    totalPaid: payments.reduce((sum, p) => sum + (Number(p.nominal_bayar) || 0), 0),
    transactions: payments.length,
    byEkskul,
    popular: Object.entries(byEkskul)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nama, jumlah]) => ({ nama, jumlah })),
  };
}

/* ------------------------------------------------------------------ */
/* Mutasi: pendaftaran ekskul                                          */
/* ------------------------------------------------------------------ */
export function addEnrollment(studentId, ekskulNama) {
  const db = getDB();
  const student = (db.students || []).find((s) => s.id === studentId);
  if (!student) return { ok: false, error: 'Siswa tidak ditemukan.' };

  const nama = String(ekskulNama || '').trim();
  if (!nama) return { ok: false, error: 'Silakan pilih ekskul terlebih dahulu.' };

  const exists = enrollmentsOf(studentId).some(
    (row) => normalizeText(row.ekskul_nama) === normalizeText(nama),
  );
  if (exists) {
    return { ok: false, error: `${student.nama_lengkap} sudah terdaftar di ekskul ${nama}.` };
  }

  const now = nowISO();
  const enrollment = {
    id: uid('eks'),
    student_id: studentId,
    ekskul_nama: nama,
    biaya_bulanan: getEkskulFee(nama),
    tahun_ajaran: getAcademicYearLabelFromNoInduk(student.no_induk),
    status: 'aktif',
    created_at: now,
    updated_at: now,
  };

  commit((draft) => {
    draft.student_ekskul = [...(draft.student_ekskul || []), enrollment];
  });
  return { ok: true, enrollment };
}

/**
 * Pastikan siswa terdaftar pada sebuah ekskul. Dipakai saat pembayaran ekskul
 * dicatat dari modul Pembayaran: bila belum ada pendaftaran aktif untuk ekskul
 * tsb, pendaftaran baru dibuat otomatis (tercatat tanggal pendaftarannya).
 * Ekskul lain yang sudah diikuti tetap aktif — riwayat tidak ditimpa.
 */
export function ensureEnrollment(studentId, ekskulNama) {
  const db = getDB();
  const student = (db.students || []).find((s) => s.id === studentId);
  if (!student) return { ok: false, error: 'Siswa tidak ditemukan.' };

  const nama = String(ekskulNama || '').trim();
  if (!nama) return { ok: false, error: 'Ekskul wajib dipilih.' };

  const existing = enrollmentsOf(studentId).find(
    (row) => normalizeText(row.ekskul_nama) === normalizeText(nama),
  );
  if (existing) return { ok: true, enrollment: existing, created: false };

  const now = nowISO();
  const enrollment = {
    id: uid('eks'),
    student_id: studentId,
    ekskul_nama: nama,
    biaya_bulanan: getEkskulFee(nama),
    tahun_ajaran: getAcademicYearLabelFromNoInduk(student.no_induk),
    status: 'aktif',
    created_at: now,
    updated_at: now,
  };

  commit((draft) => {
    draft.student_ekskul = [...(draft.student_ekskul || []), enrollment];
  });
  return { ok: true, enrollment, created: true };
}

export function updateEnrollment(id, payload) {
  const db = getDB();
  const current = (db.student_ekskul || []).find((row) => row.id === id);
  if (!current) return { ok: false, error: 'Data ekskul tidak ditemukan.' };

  const nama = payload.ekskul_nama ?? current.ekskul_nama;
  const updated = {
    ...current,
    ekskul_nama: nama,
    biaya_bulanan:
      payload.biaya_bulanan !== undefined ? Number(payload.biaya_bulanan) : getEkskulFee(nama),
    updated_at: nowISO(),
  };

  commit((draft) => {
    const index = (draft.student_ekskul || []).findIndex((row) => row.id === id);
    if (index >= 0) draft.student_ekskul[index] = updated;
    // Selaraskan nama ekskul pada riwayat pembayarannya.
    draft.ekskul_payments = (draft.ekskul_payments || []).map((payment) =>
      payment.student_ekskul_id === id ? { ...payment, ekskul_nama: updated.ekskul_nama } : payment,
    );
  });
  return { ok: true, enrollment: updated };
}

export function removeEnrollment(id) {
  const db = getDB();
  const exists = (db.student_ekskul || []).some((row) => row.id === id);
  if (!exists) return { ok: false, error: 'Data ekskul tidak ditemukan.' };

  commit((draft) => {
    draft.student_ekskul = (draft.student_ekskul || []).filter((row) => row.id !== id);
    draft.ekskul_payments = (draft.ekskul_payments || []).filter(
      (row) => row.student_ekskul_id !== id,
    );
  });
  return { ok: true };
}

/** Hapus seluruh data ekskul (pendaftaran + pembayaran) milik satu siswa. */
export function removeStudentEkskul(studentId) {
  const enrollments = enrollmentsOf(studentId);
  if (enrollments.length === 0) {
    return { ok: false, error: 'Belum ada data ekskul untuk siswa ini.' };
  }
  const ids = new Set(enrollments.map((row) => row.id));

  commit((draft) => {
    draft.student_ekskul = (draft.student_ekskul || []).filter(
      (row) => row.student_id !== studentId,
    );
    draft.ekskul_payments = (draft.ekskul_payments || []).filter(
      (row) => !ids.has(row.student_ekskul_id),
    );
  });
  return { ok: true, count: enrollments.length };
}

/* ------------------------------------------------------------------ */
/* Mutasi: pembayaran ekskul                                           */
/* ------------------------------------------------------------------ */
export function getEnrollmentPayments(enrollmentId) {
  return paymentsOf(enrollmentId);
}

/**
 * Deteksi pembayaran ganda pada bulan yang sama. Bila `periodStart` diisi,
 * bulan yang sama pada periode tahun ajaran lain bukan duplikat.
 */
export function checkDuplicateMonth(enrollmentId, bulan, excludePaymentId = null, periodStart = null) {
  const found = paymentsOf(enrollmentId).filter(
    (row) =>
      row.bulan === bulan &&
      row.id !== excludePaymentId &&
      (periodStart === null ||
        periodStart === undefined ||
        periodStartOf(row.bulan, row.tahun) === Number(periodStart)),
  );
  return {
    hasDuplicate: found.length > 0,
    count: found.length,
    total: found.reduce((sum, row) => sum + (Number(row.nominal_bayar) || 0), 0),
    payments: found,
  };
}

/** Simulasi pembayaran tanpa menulis ke database. */
export function previewEkskulPayment({
  enrollmentId,
  bulan,
  nominal,
  excludePaymentId = null,
  periodStart = null,
}) {
  const db = getDB();
  const enrollment = (db.student_ekskul || []).find((row) => row.id === enrollmentId);
  if (!enrollment) return null;

  const monthlyFee = Number(enrollment.biaya_bulanan) || getEkskulFee(enrollment.ekskul_nama);
  const scope = Number(periodStart) || currentPeriodStart();
  const payments = paymentsOf(enrollmentId)
    .filter((row) => row.id !== excludePaymentId)
    .filter((row) => periodStartOf(row.bulan, row.tahun) === scope);
  const monthTotal = payments
    .filter((row) => row.bulan === bulan)
    .reduce((sum, row) => sum + (Number(row.nominal_bayar) || 0), 0);
  const amount = Number(nominal) || 0;

  return {
    enrollment,
    monthlyFee,
    monthTotal,
    projectedMonthTotal: monthTotal + amount,
    amount,
    isFull: monthTotal + amount >= monthlyFee,
    isOverpay: monthTotal + amount > monthlyFee,
    overpaid: Math.max(monthTotal + amount - monthlyFee, 0),
    duplicate: checkDuplicateMonth(enrollmentId, bulan, excludePaymentId, scope),
  };
}

export function addEkskulPayment({
  enrollmentId,
  bulan,
  nominal,
  tanggalBayar,
  keterangan,
  tahun,
  createdBy,
}) {
  const db = getDB();
  const enrollment = (db.student_ekskul || []).find((row) => row.id === enrollmentId);
  if (!enrollment) return { ok: false, error: 'Data ekskul tidak ditemukan.' };
  if (!bulan) return { ok: false, error: 'Bulan pembayaran wajib dipilih.' };
  if (!MONTHS.includes(bulan)) return { ok: false, error: 'Bulan pembayaran tidak valid.' };

  const amount = Number(nominal) || 0;
  if (amount <= 0) return { ok: false, error: 'Nominal pembayaran harus lebih dari 0.' };

  const now = nowISO();
  const payment = {
    id: uid('exp'),
    student_ekskul_id: enrollmentId,
    student_id: enrollment.student_id,
    ekskul_nama: enrollment.ekskul_nama,
    bulan,
    tahun: Number(tahun) || paymentYearFor(bulan),
    nominal_bayar: amount,
    tanggal_bayar: tanggalBayar || now.slice(0, 10),
    keterangan: keterangan || null,
    created_by: createdBy || 'Tata Usaha',
    created_at: now,
    updated_at: now,
  };

  commit((draft) => {
    draft.ekskul_payments = [...(draft.ekskul_payments || []), payment];
  });
  return { ok: true, payment };
}

export function updateEkskulPayment(id, payload) {
  const db = getDB();
  const current = (db.ekskul_payments || []).find((row) => row.id === id);
  if (!current) return { ok: false, error: 'Transaksi pembayaran tidak ditemukan.' };

  const amount = payload.nominal !== undefined ? Number(payload.nominal) : current.nominal_bayar;
  if (amount <= 0) return { ok: false, error: 'Nominal pembayaran harus lebih dari 0.' };

  const updated = {
    ...current,
    bulan: payload.bulan ?? current.bulan,
    nominal_bayar: amount,
    tanggal_bayar: payload.tanggalBayar ?? current.tanggal_bayar,
    keterangan: payload.keterangan ?? current.keterangan,
    updated_at: nowISO(),
  };

  commit((draft) => {
    const index = (draft.ekskul_payments || []).findIndex((row) => row.id === id);
    if (index >= 0) draft.ekskul_payments[index] = updated;
  });
  return { ok: true, payment: updated };
}

export function deleteEkskulPayment(id) {
  const exists = (getDB().ekskul_payments || []).some((row) => row.id === id);
  if (!exists) return { ok: false, error: 'Transaksi pembayaran tidak ditemukan.' };

  commit((draft) => {
    draft.ekskul_payments = (draft.ekskul_payments || []).filter((row) => row.id !== id);
  });
  return { ok: true };
}

export { MONTHS };
