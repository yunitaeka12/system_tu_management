import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useDebounce } from './useDebounce';
import * as ekskulService from '../services/ekskulService';

/** Hook daftar baris ekskul (siswa + ekskul yang diikuti). */
export function useEkskulRows({
  search = '',
  kelas = '',
  tahunAjaran = '',
  page = 1,
  pageSize = 10,
  order = { field: 'nama_lengkap', direction: 'asc' },
  debounceMs = 300,
} = {}) {
  const { version } = useData();
  const debouncedSearch = useDebounce(search, debounceMs);

  const result = useMemo(
    () =>
      ekskulService.listEkskulRows({
        search: debouncedSearch,
        kelas,
        tahunAjaran,
        page,
        pageSize,
        order,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      debouncedSearch,
      kelas,
      tahunAjaran,
      page,
      pageSize,
      order.field,
      order.direction,
      version,
    ],
  );

  return { ...result, isSearching: search !== debouncedSearch };
}

/** Detail ekskul satu siswa. */
export function useStudentEkskul(studentId) {
  const { version } = useData();
  return useMemo(
    () => (studentId ? ekskulService.getStudentEkskul(studentId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [studentId, version],
  );
}

export function useEkskulStats() {
  const { version } = useData();
  return useMemo(() => ekskulService.getEkskulStats(), [version]);
}

export default useEkskulRows;
