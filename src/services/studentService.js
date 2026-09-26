/**
 * Service Buku Induk (master data siswa).
 *
 * Catatan arsitektur: pada versi Supabase, data bersarang (father, mother,
 * guardian, address) akan ditulis ke tabel terpisah (student_fathers,
 * student_mothers, student_guardians, parent_addresses). Di layer ini
 * disimpan inline agar ringan, namun bentuk objeknya identik sehingga
 * pemindahan ke backend tidak mengubah komponen UI.
 */
import { getDB, commit } from '../lib/db';
import { uid, normalizeText } from '../utils/helpers';
import { getAcademicYearFromNoInduk } from '../utils/paymentCalculator';

const DEFAULT_ORDER = { field: 'nama_lengkap', direction: 'asc' };

/** Normalisasi field turunan (ayah/ibu/wali/alamat) supaya tidak undefined. */
export function normalizeStudent(student = {}) {
  const emptyParent = { nama: null, tahun_lahir: null, nik: null, agama: null, pendidikan: null, penghasilan: null, pekerjaan: null };
  return {
    ...student,
    father: { ...emptyParent, ...(student.father || {}) },
    mother: { ...emptyParent, ...(student.mother || {}) },
    guardian: {
      nama: null,
      tahun_lahir: null,
      agama: null,
      pendidikan: null,
      pekerjaan: null,
      alamat: null,
      hubungan_keluarga: null,
      ...(student.guardian || {}),
    },
    address: {
      jalan: null,
      nama_dusun: null,
      rt_rw: null,
      kelurahan: null,
      kecamatan: null,
      kota_kabupaten: null,
      provinsi: null,
      nomor_hp: null,
      ...(student.address || {}),
    },
  };
}

function sortStudents(list, order = DEFAULT_ORDER) {
  const { field, direction } = { ...DEFAULT_ORDER, ...order };
  const factor = direction === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    const av = a[field] ?? '';
    const bv = b[field] ?? '';
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
    return String(av).localeCompare(String(bv), 'id', { numeric: true }) * factor;
  });
}

/** Ambil daftar siswa dengan search, filter, sort, dan pagination. */
export function listStudents({
  search = '',
  kelas = '',
  rombel = '',
  jenisKelamin = '',
  tahunAjaran = '',
  page = 1,
  pageSize = 10,
  order = DEFAULT_ORDER,
} = {}) {
  const all = getDB().students || [];
  const keyword = normalizeText(search);
  const digits = String(search || '').replace(/\D/g, '');

  let filtered = all;

  if (keyword || digits) {
    filtered = filtered.filter((s) => {
      const haystack = normalizeText(
        `${s.nama_lengkap} ${s.nama_panggilan ?? ''} ${s.kelas} ${s.rombel} ${s.no_induk} ${s.nisn}`,
      );
      if (keyword && haystack.includes(keyword)) return true;
      if (digits && (String(s.no_induk).includes(digits) || String(s.nisn || '').includes(digits))) {
        return true;
      }
      return false;
    });
  }

  if (kelas) filtered = filtered.filter((s) => s.kelas === kelas);
  if (rombel) filtered = filtered.filter((s) => String(s.rombel) === String(rombel));
  if (jenisKelamin) filtered = filtered.filter((s) => s.jenis_kelamin === jenisKelamin);
  if (tahunAjaran) {
    filtered = filtered.filter(
      (s) => getAcademicYearFromNoInduk(s.no_induk)?.prefix === tahunAjaran,
    );
  }

  const total = filtered.length;
  const sorted = sortStudents(filtered, order);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    data: sorted.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export function getStudent(id) {
  const student = (getDB().students || []).find((s) => s.id === id);
  return student ? normalizeStudent(student) : null;
}

export function getStudentByNoInduk(noInduk) {
  const student = (getDB().students || []).find(
    (s) => String(s.no_induk) === String(noInduk).trim(),
  );
  return student ? normalizeStudent(student) : null;
}

export function getAllStudents() {
  return getDB().students || [];
}

export function createStudent(payload) {
  const now = new Date().toISOString();
  const noInduk = String(payload.no_induk || '').trim();

  const existing = getStudentByNoInduk(noInduk);
  if (existing) {
    return { ok: false, error: `No Induk ${noInduk} sudah digunakan oleh ${existing.nama_lengkap}.` };
  }

  const student = normalizeStudent({
    ...payload,
    id: uid('stu'),
    no_induk: noInduk,
    created_at: now,
    updated_at: now,
  });

  commit((draft) => {
    draft.students = [...(draft.students || []), student];
  });
  return { ok: true, student };
}

export function updateStudent(id, payload) {
  const current = getStudent(id);
  if (!current) return { ok: false, error: 'Siswa tidak ditemukan.' };

  const noInduk = String(payload.no_induk ?? current.no_induk).trim();
  const conflict = (getDB().students || []).find(
    (s) => s.id !== id && String(s.no_induk) === noInduk,
  );
  if (conflict) {
    return { ok: false, error: `No Induk ${noInduk} sudah digunakan oleh ${conflict.nama_lengkap}.` };
  }

  const updated = normalizeStudent({
    ...current,
    ...payload,
    no_induk: noInduk,
    id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
  });

  commit((draft) => {
    const index = draft.students.findIndex((s) => s.id === id);
    if (index >= 0) draft.students[index] = updated;
  });
  return { ok: true, student: updated };
}

export function deleteStudent(id) {
  const student = getStudent(id);
  if (!student) return { ok: false, error: 'Siswa tidak ditemukan.' };

  commit((draft) => {
    draft.students = draft.students.filter((s) => s.id !== id);
    // Ikut hapus transaksi pembayaran milik siswa (foreign key cascade).
    draft.payments = (draft.payments || []).filter((p) => p.student_id !== id);
    // Sekaligus data ekskul siswa tersebut.
    draft.ekskul_payments = (draft.ekskul_payments || []).filter(
      (p) => p.student_id !== id,
    );
    draft.student_ekskul = (draft.student_ekskul || []).filter(
      (row) => row.student_id !== id,
    );
  });
  return { ok: true };
}

export function countStudentsWithPayments() {
  const db = getDB();
  return new Set((db.payments || []).map((p) => p.student_id)).size;
}

/** Opsi filter dinamis dari data yang ada. */
export function getFilterOptions() {
  const students = getDB().students || [];
  const kelas = [...new Set(students.map((s) => s.kelas).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'id', { numeric: true }),
  );
  const rombel = [...new Set(students.map((s) => s.rombel).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), 'id', { numeric: true }),
  );

  // Tahun ajaran diturunkan dari 4 digit awal No Induk (2122 → 2021/2022).
  const yearMap = new Map();
  students.forEach((s) => {
    const year = getAcademicYearFromNoInduk(s.no_induk);
    if (year) yearMap.set(year.prefix, year);
  });
  const tahunAjaran = [...yearMap.values()]
    .sort((a, b) => b.start - a.start)
    .map((year) => ({ value: year.prefix, label: year.label }));

  return { kelas, rombel, tahunAjaran };
}

/** Siswa yang cocok dengan kriteria hapus massal. */
export function filterForBulkDelete({ kelas = '', tahunAjaran = '' } = {}) {
  const students = getDB().students || [];
  return students.filter((student) => {
    if (kelas && student.kelas !== kelas) return false;
    if (tahunAjaran && getAcademicYearFromNoInduk(student.no_induk)?.prefix !== tahunAjaran) {
      return false;
    }
    return true;
  });
}

/** Ringkasan dampak sebelum menghapus (untuk ditampilkan ke Administrator). */
export function previewBulkDelete({ kelas = '', tahunAjaran = '' } = {}) {
  const db = getDB();
  const targets = filterForBulkDelete({ kelas, tahunAjaran });
  const ids = new Set(targets.map((student) => student.id));
  const enrollmentIds = new Set(
    (db.student_ekskul || [])
      .filter((row) => ids.has(row.student_id))
      .map((row) => row.id),
  );

  return {
    students: targets.length,
    payments: (db.payments || []).filter((row) => ids.has(row.student_id)).length,
    ekskul: (db.student_ekskul || []).filter((row) => ids.has(row.student_id)).length,
    ekskulPayments: (db.ekskul_payments || [])
      .filter((row) => ids.has(row.student_id) || enrollmentIds.has(row.student_ekskul_id))
      .length,
    sample: targets.slice(0, 5).map((student) => student.nama_lengkap),
  };
}

/**
 * Hapus massal berdasarkan kelas dan/atau tahun ajaran.
 * mode: 'students' (siswa + seluruh datanya) atau 'payments' (hanya transaksi).
 */
export function bulkDelete({ kelas = '', tahunAjaran = '', mode = 'students' } = {}) {
  if (!kelas && !tahunAjaran) {
    return { ok: false, error: 'Pilih minimal satu kriteria (kelas atau tahun ajaran).' };
  }

  const targets = filterForBulkDelete({ kelas, tahunAjaran });
  if (targets.length === 0) {
    return { ok: false, error: 'Tidak ada data yang cocok dengan kriteria tersebut.' };
  }

  const ids = new Set(targets.map((student) => student.id));

  if (mode === 'payments') {
    const before = (getDB().payments || []).length;
    commit((draft) => {
      draft.payments = (draft.payments || []).filter((row) => !ids.has(row.student_id));
      draft.ekskul_payments = (draft.ekskul_payments || []).filter(
        (row) => !ids.has(row.student_id),
      );
    });
    const after = (getDB().payments || []).length;
    return { ok: true, mode, students: targets.length, payments: before - after };
  }

  const summary = previewBulkDelete({ kelas, tahunAjaran });
  commit((draft) => {
    draft.students = (draft.students || []).filter((student) => !ids.has(student.id));
    draft.payments = (draft.payments || []).filter((row) => !ids.has(row.student_id));
    draft.ekskul_payments = (draft.ekskul_payments || []).filter(
      (row) => !ids.has(row.student_id),
    );
    draft.student_ekskul = (draft.student_ekskul || []).filter(
      (row) => !ids.has(row.student_id),
    );
  });

  return { ok: true, mode: 'students', ...summary };
}

/** Statistik ringkas Buku Induk. */
export function getStudentStats() {
  const students = getDB().students || [];
  const byKelas = {};
  students.forEach((s) => {
    const key = s.kelas || 'Tanpa Kelas';
    byKelas[key] = (byKelas[key] || 0) + 1;
  });
  return {
    total: students.length,
    lakiLaki: students.filter((s) => s.jenis_kelamin === 'Laki-laki').length,
    perempuan: students.filter((s) => s.jenis_kelamin === 'Perempuan').length,
    totalKelas: Object.keys(byKelas).length,
    byKelas,
  };
}
