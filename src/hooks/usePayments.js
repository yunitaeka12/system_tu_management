import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useDebounce } from './useDebounce';
import * as paymentService from '../services/paymentService';

/** Hook daftar baris pembayaran (join siswa + ringkasan keuangan). */
export function usePayments({
  search = '',
  kelas = '',
  status = '',
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
      paymentService.listPaymentRows({
        search: debouncedSearch,
        kelas,
        status,
        tahunAjaran,
        page,
        pageSize,
        order,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      debouncedSearch,
      kelas,
      status,
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

/** Ringkasan + riwayat pembayaran satu siswa. */
export function useStudentPayment(studentId) {
  const { version } = useData();
  return useMemo(
    () => (studentId ? paymentService.getStudentPaymentSummary(studentId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [studentId, version],
  );
}

export function useDashboardMetrics() {
  const { version } = useData();
  return useMemo(() => paymentService.getDashboardMetrics(), [version]);
}

export function usePaymentChart() {
  const { version } = useData();
  return useMemo(() => paymentService.getMonthlyPaymentChart(), [version]);
}

export function useRecentPayments(limit = 6) {
  const { version } = useData();
  return useMemo(() => paymentService.getRecentPayments(limit), [version, limit]);
}

export function useClassInsight(limit = 6) {
  const { version } = useData();
  return useMemo(() => paymentService.getPaymentInsightByClass(limit), [version, limit]);
}

export function useTopOutstanding(limit = 5) {
  const { version } = useData();
  return useMemo(() => paymentService.getTopOutstandingStudents(limit), [version, limit]);
}

export default usePayments;
