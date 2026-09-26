/**
 * Service Import Buku Induk dari Excel.
 *
 * Alur: upload → parse → validasi kolom → validasi No Induk/NISN →
 * deteksi duplikat → preview (valid & error) → konfirmasi → insert/update.
 * Tidak ada data yang masuk sebelum user menekan "Import".
 */
import * as XLSX from 'xlsx';
import { getDB, commit } from '../lib/db';
import { normalizeStudent } from './studentService';
import { uid } from '../utils/helpers';

/* Pemetaan index kolom mengikuti struktur grouped header file Excel asli. */
const COL = {
  no: 0,
  rombel: 1,
  kelas: 2,
  noInduk: 3,
  nisn: 4,
  namaLengkap: 5,
  noKk: 6,
  nik: 7,
  noRegisAkta: 8,
  namaPanggilan: 9,
  jenisKelamin: 10,
  agama: 11,
  kewarganegaraan: 12,
  tempatTanggalLahir: 13,
  anakKe: 14,
  jumlahSaudara: 15,
  bahasa: 18,
  alamat: 19,
  nomorHp: 20,
  tinggalBersama: 21,
  jarak: 22,
  waktuTempuh: 23,
  pendidikanSebelumnya: 24,
  ayahNama: 25,
  ayahTahunLahir: 26,
  ayahNik: 27,
  ayahAgama: 28,
  ayahPendidikan: 29,
  ayahPenghasilan: 30,
  ayahPekerjaan: 31,
  ibuNama: 32,
  ibuTahunLahir: 33,
  ibuNik: 34,
  ibuAgama: 35,
  ibuPendidikan: 36,
  ibuPenghasilan: 37,
  ibuPekerjaan: 38,
  ortuJalan: 39,
  ortuDusun: 40,
  ortuRtRw: 41,
  ortuKelurahan: 42,
  ortuKecamatan: 43,
  ortuKota: 44,
  ortuProvinsi: 45,
  ortuNomorHp: 46,
  waliNama: 47,
  waliTahunLahir: 48,
  waliAgama: 49,
  waliPendidikan: 50,
  waliPekerjaan: 51,
  waliAlamat: 52,
  waliHubungan: 53,
  tinggiBadan: 54,
  beratBadan: 55,
  lingkarKepala: 56,
  keterangan: 57,
};

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const REQUIRED_COLUMNS = ['No Induk', 'Nama Lengkap', 'NISN', 'KELAS'];

/* ------------------------------ helpers ------------------------------ */
function cleanText(value) {
  if (value === null || value === undefined) return null;
  let text = String(value).trim().replace(/^'+/, '').trim();
  if (!text) return null;
  return text.replace(/\s+/g, ' ');
}

function cleanCode(value) {
  const text = cleanText(value);
  if (text === null) return null;
  const normalized = text.replace(/[^0-9A-Za-z\-]/g, '');
  return normalized || null;
}

function normalizeBirthYear(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isNaN(num) && num > 0) {
    if (num >= 1000 && num <= 2100) return String(Math.trunc(num));
    if (num > 20000 && num < 60000) {
      return String(new Date(EXCEL_EPOCH + num * 86400000).getUTCFullYear());
    }
  }
  const text = cleanText(value);
  if (!text) return null;
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : text;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(num) ? null : num;
}

function normalizeGender(value) {
  const text = cleanText(value);
  if (!text) return null;
  const upper = text.toUpperCase();
  if (upper.startsWith('L')) return 'Laki-laki';
  if (upper.startsWith('P')) return 'Perempuan';
  return text;
}

const hasValue = (obj) => Object.values(obj).some((v) => v !== null && v !== undefined);

/* ------------------------------ parsing ------------------------------ */

/** Baca file Excel menjadi array baris mentah + info sheet. */
export async function parseWorkbookFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: true });

  // Deteksi baris header (baris yang memuat "No Induk").
  const headerIndex = rows.findIndex(
    (row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').toLowerCase().includes('no induk')),
  );
  const headerRow = headerIndex >= 0 ? rows[headerIndex] : rows[0];
  const dataRows = rows.slice((headerIndex >= 0 ? headerIndex : 0) + 2);

  const headers = (headerRow || []).map((h) => cleanText(h) || '');
  const foundRequired = REQUIRED_COLUMNS.filter((name) =>
    headers.some((h) => h.toLowerCase().includes(name.toLowerCase())),
  );

  return {
    sheetName,
    headers,
    dataRows,
    headerIndex: headerIndex >= 0 ? headerIndex : 0,
    missingColumns: REQUIRED_COLUMNS.filter((c) => !foundRequired.includes(c)),
    totalRows: dataRows.length,
  };
}

/** Ubah satu baris mentah menjadi objek siswa. */
function mapRow(row) {
  const father = {
    nama: cleanText(row[COL.ayahNama]),
    tahun_lahir: normalizeBirthYear(row[COL.ayahTahunLahir]),
    nik: cleanCode(row[COL.ayahNik]),
    agama: cleanText(row[COL.ayahAgama]),
    pendidikan: cleanText(row[COL.ayahPendidikan]),
    penghasilan: cleanText(row[COL.ayahPenghasilan]),
    pekerjaan: cleanText(row[COL.ayahPekerjaan]),
  };
  const mother = {
    nama: cleanText(row[COL.ibuNama]),
    tahun_lahir: normalizeBirthYear(row[COL.ibuTahunLahir]),
    nik: cleanCode(row[COL.ibuNik]),
    agama: cleanText(row[COL.ibuAgama]),
    pendidikan: cleanText(row[COL.ibuPendidikan]),
    penghasilan: cleanText(row[COL.ibuPenghasilan]),
    pekerjaan: cleanText(row[COL.ibuPekerjaan]),
  };
  const guardian = {
    nama: cleanText(row[COL.waliNama]),
    tahun_lahir: normalizeBirthYear(row[COL.waliTahunLahir]),
    agama: cleanText(row[COL.waliAgama]),
    pendidikan: cleanText(row[COL.waliPendidikan]),
    pekerjaan: cleanText(row[COL.waliPekerjaan]),
    alamat: cleanText(row[COL.waliAlamat]),
    hubungan_keluarga: cleanText(row[COL.waliHubungan]),
  };
  const address = {
    jalan: cleanText(row[COL.ortuJalan]),
    nama_dusun: cleanText(row[COL.ortuDusun]),
    rt_rw: cleanText(row[COL.ortuRtRw]),
    kelurahan: cleanText(row[COL.ortuKelurahan]),
    kecamatan: cleanText(row[COL.ortuKecamatan]),
    kota_kabupaten: cleanText(row[COL.ortuKota]),
    provinsi: cleanText(row[COL.ortuProvinsi]),
    nomor_hp: cleanText(row[COL.ortuNomorHp]),
  };

  return {
    no_urut: normalizeNumber(row[COL.no]),
    rombel: cleanText(row[COL.rombel]),
    kelas: cleanText(row[COL.kelas]),
    no_induk: cleanCode(row[COL.noInduk]),
    nisn: cleanCode(row[COL.nisn]),
    nama_lengkap: cleanText(row[COL.namaLengkap]),
    nama_panggilan: cleanText(row[COL.namaPanggilan]),
    no_kk: cleanCode(row[COL.noKk]),
    nik: cleanCode(row[COL.nik]),
    no_regis_akta: cleanText(row[COL.noRegisAkta]),
    jenis_kelamin: normalizeGender(row[COL.jenisKelamin]),
    agama: cleanText(row[COL.agama]),
    kewarganegaraan: cleanText(row[COL.kewarganegaraan]),
    tempat_tanggal_lahir: cleanText(row[COL.tempatTanggalLahir]),
    anak_ke: normalizeNumber(row[COL.anakKe]),
    jumlah_saudara: normalizeNumber(row[COL.jumlahSaudara]),
    bahasa_sehari_hari: cleanText(row[COL.bahasa]),
    alamat: cleanText(row[COL.alamat]),
    nomor_hp: cleanText(row[COL.nomorHp]),
    tinggal_bersama: cleanText(row[COL.tinggalBersama]),
    jarak_tempat_tinggal: cleanText(row[COL.jarak]),
    waktu_tempuh: cleanText(row[COL.waktuTempuh]),
    pendidikan_sebelumnya: cleanText(row[COL.pendidikanSebelumnya]),
    tinggi_badan: normalizeNumber(row[COL.tinggiBadan]),
    berat_badan: normalizeNumber(row[COL.beratBadan]),
    lingkar_kepala: normalizeNumber(row[COL.lingkarKepala]),
    keterangan: cleanText(row[COL.keterangan]),
    father: hasValue(father) ? father : null,
    mother: hasValue(mother) ? mother : null,
    guardian: hasValue(guardian) ? guardian : null,
    address: hasValue(address) ? address : null,
  };
}

/**
 * Validasi + bangun preview import.
 * PENTING: fungsi ini tidak menulis apa pun ke database.
 */
export function buildImportPreview(parsed, { mode = 'skip' } = {}) {
  const existing = getDB().students || [];
  const byNoInduk = new Map(existing.map((s) => [String(s.no_induk), s]));
  const byNisn = new Map(existing.filter((s) => s.nisn).map((s) => [String(s.nisn), s]));

  const seenInFile = new Set();
  const seenNisnInFile = new Set();

  const valid = [];
  const invalid = [];
  const duplicates = [];
  const duplicateNisn = [];

  parsed.dataRows.forEach((row, index) => {
    const rowNumber = index + (parsed.headerIndex ?? 0) + 3;
    const student = mapRow(row);

    // Baris kosong (biasanya pemisah) → lewati tanpa dihitung error.
    if (!student.no_induk && !student.nama_lengkap) return;

    const errors = [];
    if (!student.no_induk) errors.push('No Induk kosong');
    if (!student.nama_lengkap) errors.push('Nama Lengkap kosong');
    if (!student.kelas) errors.push('Kelas kosong');
    if (student.nisn && !/^\d{8,12}$/.test(String(student.nisn))) {
      errors.push('NISN tidak valid (harus 8-12 digit)');
    }

    if (student.no_induk && seenInFile.has(String(student.no_induk))) {
      errors.push('No Induk duplikat di dalam file');
    }

    if (errors.length > 0) {
      invalid.push({ rowNumber, student, errors });
      if (student.no_induk) seenInFile.add(String(student.no_induk));
      return;
    }

    seenInFile.add(String(student.no_induk));

    const isExistingNoInduk = byNoInduk.has(String(student.no_induk));
    const nisnOwner = student.nisn ? byNisn.get(String(student.nisn)) : null;
    const nisnConflict =
      nisnOwner && String(nisnOwner.no_induk) !== String(student.no_induk) ? nisnOwner : null;

    if (isExistingNoInduk) {
      duplicates.push({
        rowNumber,
        student,
        existing: byNoInduk.get(String(student.no_induk)),
        action: mode,
      });
      return;
    }

    if (nisnConflict) {
      duplicateNisn.push({ rowNumber, student, conflicting: nisnConflict, errors: ['NISN sudah dipakai siswa lain'] });
      invalid.push({
        rowNumber,
        student,
        errors: [`NISN sudah dipakai ${nisnConflict.nama_lengkap} (${nisnConflict.no_induk})`],
      });
      return;
    }

    if (student.nisn) seenNisnInFile.add(String(student.nisn));
    valid.push({ rowNumber, student });
  });

  return {
    valid,
    invalid,
    duplicates,
    duplicateNisn,
    summary: {
      totalRows: parsed.totalRows,
      validCount: valid.length,
      invalidCount: invalid.length,
      duplicateCount: duplicates.length,
      newCount: valid.length,
      updateCount: mode === 'update' ? duplicates.length : 0,
      skipCount: mode === 'skip' ? duplicates.length : 0,
    },
    readyToImport: valid.length + (mode === 'update' ? duplicates.length : 0),
  };
}

/**
 * Eksekusi import dengan progress callback.
 * @param {object} preview hasil buildImportPreview
 * @param {{mode: 'skip'|'update', onProgress?: (done:number,total:number)=>void}} options
 */
export async function executeImport(preview, { mode = 'skip', onProgress } = {}) {
  const now = new Date().toISOString();
  const updates = mode === 'update' ? preview.duplicates : [];
  const inserts = preview.valid;
  const total = inserts.length + updates.length;

  let done = 0;
  const batchSize = 60;

  const process = (items, handler) =>
    new Promise((resolve) => {
      let position = 0;
      const next = () => {
        const slice = items.slice(position, position + batchSize);
        slice.forEach((item) => {
          handler(item);
          done += 1;
        });
        position += batchSize;
        if (onProgress) onProgress(Math.min(done, total), total);
        if (position < items.length) {
          setTimeout(next, 0);
        } else {
          resolve();
        }
      };
      if (items.length === 0) return resolve();
      return next();
    });

  const updateMap = new Map();
  await process(updates, (item) => {
    updateMap.set(String(item.student.no_induk), item.student);
  });

  const insertList = inserts.map((item) => item.student);
  await process(insertList, () => {});

  commit((draft) => {
    const existing = draft.students || [];
    const merged = existing.map((student) => {
      const replacement = updateMap.get(String(student.no_induk));
      if (!replacement) return student;
      return normalizeStudent({
        ...student,
        ...replacement,
        id: student.id,
        created_at: student.created_at,
        updated_at: now,
      });
    });

    const newStudents = insertList.map((student, index) => ({
      ...normalizeStudent(student),
      id: uid('stu'),
      created_at: now,
      updated_at: now,
      _order: existing.length + index,
    }));

    draft.students = [...merged, ...newStudents];
    draft.meta = {
      ...(draft.meta || {}),
      last_student_import: {
        at: now,
        inserted: newStudents.length,
        updated: updateMap.size,
        skipped: preview.duplicates.length - updateMap.size,
        source: preview.sourceFile || null,
      },
    };
  });

  return {
    ok: true,
    inserted: inserts.length,
    updated: updates.length,
    skipped: mode === 'skip' ? preview.duplicates.length : 0,
    failed: preview.invalid.length,
  };
}

/** Urutan kolom template import (sama dengan kelompok header Excel asli). */
const TEMPLATE_HEADERS = [
  'No',
  'Rombel',
  'KELAS',
  'No Induk',
  'NISN',
  'Nama Lengkap',
  'No KK',
  'NIK',
  'No Regis Akta',
  'Nama panggilan',
  'Jenis Kelamin',
  'Agama',
  'Kewarganegaraan',
  'Tempat tanggal lahir',
  'Anak ke',
  'Jumlah saudara',
  'Kandung',
  'Tiri',
  'Bahasa sehari hari',
  'ALAMAT',
  'Nomor Telp/HP',
  'Tinggal bersama',
  'Jarak tempat tinggal ke sekolah',
  'Waktu Tempuh',
  'Pendidikan Peserta didik sebelumnya',
  'AYAH - Nama',
  'AYAH - Tahun lahir',
  'AYAH - NIK',
  'AYAH - Agama',
  'AYAH - Pendidikan',
  'AYAH - Penghasilan',
  'AYAH - Pekerjaan',
  'IBU - Nama',
  'IBU - Tahun lahir',
  'IBU - NIK',
  'IBU - Agama',
  'IBU - Pendidikan',
  'IBU - Penghasilan',
  'IBU - Pekerjaan',
  'Alamat Orang Tua - Jalan',
  'Alamat Orang Tua - Nama Dusun',
  'Alamat Orang Tua - Rt/Rw',
  'Alamat Orang Tua - Kelurahan/Desa',
  'Alamat Orang Tua - Kecamatan',
  'Alamat Orang Tua - Kota/Kabupaten',
  'Alamat Orang Tua - Provinsi',
  'Alamat Orang Tua - Nomor Telp/HP',
  'Wali - Nama',
  'Wali - Tahun lahir',
  'Wali - Agama',
  'Wali - Pendidikan',
  'Wali - Pekerjaan',
  'Wali - Alamat',
  'Wali - Hubungan dengan keluarga',
  'Tinggi Badan',
  'Berat Badan',
  'Lingkar Kepala',
  'Keterangan',
];

/** Buat file template Excel kosong berisi header yang benar. */
export function buildTemplateWorkbook() {
  const worksheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'BukuInduk');
  return workbook;
}
