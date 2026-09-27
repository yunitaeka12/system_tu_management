import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useDebounce } from './useDebounce';
import * as studentService from '../services/studentService';

/**
 * Hook daftar siswa dengan debounced search + server-side style filtering.
 */
export function useStudents({
  search = '',
  kelas = '',
  rombel = '',
  jenisKelamin = '',
  tahunAjaran = '',
  statusSiswa = '',
  page = 1,
  pageSize = 10,
  order = { field: 'nama_lengkap', direction: 'asc' },
  debounceMs = 300,
} = {}) {
  const { version } = useData();
  const debouncedSearch = useDebounce(search, debounceMs);

  const result = useMemo(
    () =>
      studentService.listStudents({
        search: debouncedSearch,
        kelas,
        rombel,
        jenisKelamin,
        tahunAjaran,
        statusSiswa,
        page,
        pageSize,
        order,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      debouncedSearch,
      kelas,
      rombel,
      jenisKelamin,
      tahunAjaran,
      statusSiswa,
      page,
      pageSize,
      order.field,
      order.direction,
      version,
    ],
  );

  return { ...result, isSearching: search !== debouncedSearch };
}

export function useStudent(id) {
  const { version } = useData();
  return useMemo(
    () => (id ? studentService.getStudent(id) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, version],
  );
}

export function useStudentStats() {
  const { version } = useData();
  return useMemo(() => studentService.getStudentStats(), [version]);
}

export function useFilterOptions() {
  const { version } = useData();
  return useMemo(() => studentService.getFilterOptions(), [version]);
}

export default useStudents;
