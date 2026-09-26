/**
 * Generate seed data Buku Induk dari file Excel asli.
 *
 * Jalankan: npm run seed
 *
 * Script ini membaca file Excel "BUKU INDUK SISWA AS-SALAM ISLAMIC GREEN SCHOOL.xlsx",
 * memetakan kolom sesuai struktur grouped header (AYAH, IBU, Alamat Orang Tua, Wali,
 * Data Fisik), lalu menulis src/data/students.seed.json.
 */
import XLSX from 'xlsx';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const WORKSPACE_ROOT = resolve(PROJECT_ROOT, '..');

const FILE_NAME = 'BUKU INDUK SISWA AS-SALAM ISLAMIC GREEN SCHOOL.xlsx';

const CANDIDATE_PATHS = [
  process.env.BUKU_INDUK_PATH,
  join(PROJECT_ROOT, 'data', FILE_NAME),
  join(WORKSPACE_ROOT, FILE_NAME),
  join(homedir(), 'Downloads', FILE_NAME),
  join(homedir(), 'OneDrive', 'Downloads', FILE_NAME),
].filter(Boolean);

const sourcePath = CANDIDATE_PATHS.find((p) => existsSync(p));

if (!sourcePath) {
  console.error('❌ File Excel Buku Induk tidak ditemukan. Lokasi yang dicoba:');
  CANDIDATE_PATHS.forEach((p) => console.error('   -', p));
  console.error('\nSet env BUKU_INDUK_PATH=<path file> lalu jalankan ulang.');
  process.exit(1);
}

console.log('📖 Membaca:', sourcePath);

const wb = XLSX.readFile(sourcePath);
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: true });

/* ------------------------------------------------------------------ */
/* Pemetaan index kolom (0-based) sesuai file Excel asli.              */
/* ------------------------------------------------------------------ */
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

  // AYAH (25-31)
  ayahNama: 25,
  ayahTahunLahir: 26,
  ayahNik: 27,
  ayahAgama: 28,
  ayahPendidikan: 29,
  ayahPenghasilan: 30,
  ayahPekerjaan: 31,

  // IBU (32-38)
  ibuNama: 32,
  ibuTahunLahir: 33,
  ibuNik: 34,
  ibuAgama: 35,
  ibuPendidikan: 36,
  ibuPenghasilan: 37,
  ibuPekerjaan: 38,

  // Alamat Orang Tua (39-46)
  ortuJalan: 39,
  ortuDusun: 40,
  ortuRtRw: 41,
  ortuKelurahan: 42,
  ortuKecamatan: 43,
  ortuKota: 44,
  ortuProvinsi: 45,
  ortuNomorHp: 46,

  // Wali (47-53)
  waliNama: 47,
  waliTahunLahir: 48,
  waliAgama: 49,
  waliPendidikan: 50,
  waliPekerjaan: 51,
  waliAlamat: 52,
  waliHubungan: 53,

  // Fisik (54-56)
  tinggiBadan: 54,
  beratBadan: 55,
  lingkarKepala: 56,
  keterangan: 57,
};

/* ------------------------------------------------------------------ */
/* Helper pembersihan data                                             */
/* ------------------------------------------------------------------ */

/** Bersihkan teks: hapus apostrof pembuka Excel, trim, dan normalisasi spasi. */
function cleanText(value) {
  if (value === null || value === undefined) return null;
  let text = String(value).trim();
  if (!text) return null;
  text = text.replace(/^'+/, '').trim();
  return text.replace(/\s+/g, ' ') || null;
}

/** Bersihkan nilai identitas (NIK/KK/NISN) menjadi string angka tanpa spasi. */
function cleanCode(value) {
  const text = cleanText(value);
  if (text === null) return null;
  const normalized = text.replace(/[^0-9A-Za-z\-]/g, '');
  return normalized || null;
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** "Tahun lahir" kadang berupa tahun (1994) kadang serial tanggal Excel (34214). */
function normalizeBirthYear(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isNaN(num) && num > 0) {
    if (num >= 1000 && num <= 2100) return String(Math.trunc(num));
    if (num > 20000 && num < 60000) {
      const date = new Date(EXCEL_EPOCH + num * 86400000);
      return String(date.getUTCFullYear());
    }
  }
  const text = cleanText(value);
  if (!text) return null;
  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? yearMatch[0] : text;
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

function valueAt(row, index) {
  return index === undefined ? null : row[index];
}

/* ------------------------------------------------------------------ */
/* Transformasi baris → objek siswa                                    */
/* ------------------------------------------------------------------ */
const students = [];
const seenNoInduk = new Set();
let skipped = 0;

rows.slice(2).forEach((row) => {
  const noInduk = cleanCode(valueAt(row, COL.noInduk));
  const namaLengkap = cleanText(valueAt(row, COL.namaLengkap));

  // Lewati baris kosong / baris judul ulang di tengah sheet.
  if (!noInduk || !namaLengkap) {
    skipped += 1;
    return;
  }
  if (seenNoInduk.has(noInduk)) {
    skipped += 1;
    return;
  }
  seenNoInduk.add(noInduk);

  const father = {
    nama: cleanText(valueAt(row, COL.ayahNama)),
    tahun_lahir: normalizeBirthYear(valueAt(row, COL.ayahTahunLahir)),
    nik: cleanCode(valueAt(row, COL.ayahNik)),
    agama: cleanText(valueAt(row, COL.ayahAgama)),
    pendidikan: cleanText(valueAt(row, COL.ayahPendidikan)),
    penghasilan: cleanText(valueAt(row, COL.ayahPenghasilan)),
    pekerjaan: cleanText(valueAt(row, COL.ayahPekerjaan)),
  };

  const mother = {
    nama: cleanText(valueAt(row, COL.ibuNama)),
    tahun_lahir: normalizeBirthYear(valueAt(row, COL.ibuTahunLahir)),
    nik: cleanCode(valueAt(row, COL.ibuNik)),
    agama: cleanText(valueAt(row, COL.ibuAgama)),
    pendidikan: cleanText(valueAt(row, COL.ibuPendidikan)),
    penghasilan: cleanText(valueAt(row, COL.ibuPenghasilan)),
    pekerjaan: cleanText(valueAt(row, COL.ibuPekerjaan)),
  };

  const guardian = {
    nama: cleanText(valueAt(row, COL.waliNama)),
    tahun_lahir: normalizeBirthYear(valueAt(row, COL.waliTahunLahir)),
    agama: cleanText(valueAt(row, COL.waliAgama)),
    pendidikan: cleanText(valueAt(row, COL.waliPendidikan)),
    pekerjaan: cleanText(valueAt(row, COL.waliPekerjaan)),
    alamat: cleanText(valueAt(row, COL.waliAlamat)),
    hubungan_keluarga: cleanText(valueAt(row, COL.waliHubungan)),
  };

  const address = {
    jalan: cleanText(valueAt(row, COL.ortuJalan)),
    nama_dusun: cleanText(valueAt(row, COL.ortuDusun)),
    rt_rw: cleanText(valueAt(row, COL.ortuRtRw)),
    kelurahan: cleanText(valueAt(row, COL.ortuKelurahan)),
    kecamatan: cleanText(valueAt(row, COL.ortuKecamatan)),
    kota_kabupaten: cleanText(valueAt(row, COL.ortuKota)),
    provinsi: cleanText(valueAt(row, COL.ortuProvinsi)),
    nomor_hp: cleanText(valueAt(row, COL.ortuNomorHp)),
  };

  const hasValue = (obj) => Object.values(obj).some((v) => v !== null && v !== undefined);

  students.push({
    no_urut: normalizeNumber(valueAt(row, COL.no)),
    rombel: cleanText(valueAt(row, COL.rombel)),
    kelas: cleanText(valueAt(row, COL.kelas)),
    no_induk: noInduk,
    nisn: cleanCode(valueAt(row, COL.nisn)),
    nama_lengkap: namaLengkap,
    nama_panggilan: cleanText(valueAt(row, COL.namaPanggilan)),
    no_kk: cleanCode(valueAt(row, COL.noKk)),
    nik: cleanCode(valueAt(row, COL.nik)),
    no_regis_akta: cleanText(valueAt(row, COL.noRegisAkta)),
    jenis_kelamin: normalizeGender(valueAt(row, COL.jenisKelamin)),
    agama: cleanText(valueAt(row, COL.agama)),
    kewarganegaraan: cleanText(valueAt(row, COL.kewarganegaraan)),
    tempat_tanggal_lahir: cleanText(valueAt(row, COL.tempatTanggalLahir)),
    anak_ke: normalizeNumber(valueAt(row, COL.anakKe)),
    jumlah_saudara: normalizeNumber(valueAt(row, COL.jumlahSaudara)),
    bahasa_sehari_hari: cleanText(valueAt(row, COL.bahasa)),
    alamat: cleanText(valueAt(row, COL.alamat)),
    nomor_hp: cleanText(valueAt(row, COL.nomorHp)),
    tinggal_bersama: cleanText(valueAt(row, COL.tinggalBersama)),
    jarak_tempat_tinggal: cleanText(valueAt(row, COL.jarak)),
    waktu_tempuh: cleanText(valueAt(row, COL.waktuTempuh)),
    pendidikan_sebelumnya: cleanText(valueAt(row, COL.pendidikanSebelumnya)),
    tinggi_badan: normalizeNumber(valueAt(row, COL.tinggiBadan)),
    berat_badan: normalizeNumber(valueAt(row, COL.beratBadan)),
    lingkar_kepala: normalizeNumber(valueAt(row, COL.lingkarKepala)),
    keterangan: cleanText(valueAt(row, COL.keterangan)),
    father: hasValue(father) ? father : null,
    mother: hasValue(mother) ? mother : null,
    guardian: hasValue(guardian) ? guardian : null,
    address: hasValue(address) ? address : null,
  });
});

/* ------------------------------------------------------------------ */
/* Statistik + tulis file                                              */
/* ------------------------------------------------------------------ */
const kelasSet = [...new Set(students.map((s) => s.kelas).filter(Boolean))].sort();
const outputDir = join(PROJECT_ROOT, 'src', 'data');
mkdirSync(outputDir, { recursive: true });

const outputPath = join(outputDir, 'students.seed.json');
writeFileSync(
  outputPath,
  JSON.stringify(
    { generated_at: new Date().toISOString(), source: sourcePath, kelas: kelasSet, students },
    null,
    0,
  ),
);

console.log(`✅ Berhasil memproses ${students.length} siswa (${skipped} baris dilewati).`);
console.log(`   Kelas terdeteksi: ${kelasSet.join(', ')}`);
console.log(`   Ditulis ke: ${outputPath}`);
