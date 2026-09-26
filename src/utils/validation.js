/**
 * Validasi input form. Semua validator mengembalikan pesan error (string) atau null.
 */

const NIK_REGEX = /^\d{16}$/;
const NISN_REGEX = /^\d{8,12}$/;

export function required(value, label = 'Field') {
  if (value === null || value === undefined || String(value).trim() === '') {
    return `${label} wajib diisi.`;
  }
  return null;
}

export function validateNik(value, { label = 'NIK', optional = true } = {}) {
  const text = String(value ?? '').trim();
  if (!text) return optional ? null : `${label} wajib diisi.`;
  if (!/^\d+$/.test(text)) return `${label} hanya boleh berisi angka.`;
  if (!NIK_REGEX.test(text)) return `${label} harus 16 digit.`;
  return null;
}

export function validateNisn(value, { optional = true } = {}) {
  const text = String(value ?? '').trim();
  if (!text) return optional ? null : 'NISN wajib diisi.';
  if (!/^\d+$/.test(text)) return 'NISN hanya boleh berisi angka.';
  if (!NISN_REGEX.test(text)) return 'NISN harus 8-12 digit.';
  return null;
}

export function validateNominal(value, { min = 1 } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 'Nominal pembayaran harus lebih dari 0.';
  if (num < min) return `Nominal minimal Rp ${min.toLocaleString('id-ID')}.`;
  return null;
}

export function validateYear(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const num = Number(text);
  if (!Number.isInteger(num) || num < 1900 || num > 2100) {
    return 'Tahun lahir tidak valid.';
  }
  return null;
}

/**
 * Validasi seluruh form siswa. Mengembalikan objek { field: message }.
 */
export function validateStudentForm(form) {
  const errors = {};

  const setError = (field, message) => {
    if (message) errors[field] = message;
  };

  setError('no_induk', required(form.no_induk, 'No Induk'));
  setError('nama_lengkap', required(form.nama_lengkap, 'Nama Lengkap'));
  setError('kelas', required(form.kelas, 'Kelas'));
  setError('nisn', validateNisn(form.nisn));
  setError('nik', validateNik(form.nik));
  setError('no_kk', validateNik(form.no_kk, { label: 'No KK' }));
  setError('father.nik', validateNik(form.father?.nik, { label: 'NIK Ayah' }));
  setError('mother.nik', validateNik(form.mother?.nik, { label: 'NIK Ibu' }));
  setError('father.tahun_lahir', validateYear(form.father?.tahun_lahir));
  setError('mother.tahun_lahir', validateYear(form.mother?.tahun_lahir));
  setError('guardian.tahun_lahir', validateYear(form.guardian?.tahun_lahir));

  return errors;
}
