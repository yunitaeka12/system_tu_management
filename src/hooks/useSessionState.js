import { useEffect, useState } from 'react';
import { readUiState, writeUiState } from '../lib/uiState';

/**
 * Sama seperti `useState`, tetapi nilainya diingat selama sesi tab.
 *
 * Dipakai untuk filter/pencarian/urutan halaman daftar supaya tidak ter-reset
 * ketika pengguna membuka detail baris lalu kembali ke halaman daftar (atau
 * memuat ulang halaman). Nilainya dibersihkan otomatis saat logout.
 *
 * @param {string} key kunci unik, mis. `'pembayaran.kelas'`
 * @param {unknown} initialValue nilai awal bila belum ada yang tersimpan
 */
export function useSessionState(key, initialValue) {
  const [value, setValue] = useState(() => readUiState(key, initialValue));

  useEffect(() => {
    writeUiState(key, value);
  }, [key, value]);

  return [value, setValue];
}

export default useSessionState;
