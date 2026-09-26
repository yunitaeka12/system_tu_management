import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, CircleDashed, CircleDollarSign, Clock, Pencil, Trash2 } from 'lucide-react';
import EmptyState from '../EmptyState';
import Pagination from '../Pagination';
import { MONTHS } from '../../utils/paymentCalculator';
import { formatCurrency } from '../../utils/currency';
import { formatDate, cn } from '../../utils/helpers';

const HISTORY_PAGE_SIZES = [5, 10, 50];

/**
 * Peta pembayaran bulanan dengan pembeda warna:
 * - merah  : belum dibayar sama sekali
 * - kuning : sudah dibayar sebagian (kurang dari tagihan bulan tsb)
 * - hijau  : lunas untuk bulan tersebut
 */
function MonthTracker({ payments, monthlyFee }) {
  const totalsByMonth = useMemo(() => {
    const map = new Map();
    payments.forEach((payment) => {
      map.set(
        payment.bulan,
        (map.get(payment.bulan) ?? 0) + Number(payment.nominal_bayar || 0),
      );
    });
    return map;
  }, [payments]);

  return (
    <div className="border-b border-slate-200 px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Peta Pembayaran Bulanan
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            Belum bayar
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            Sebagian
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-school-500" />
            Lunas bulan ini
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {MONTHS.map((month) => {
          const total = totalsByMonth.get(month) ?? 0;
          const isPaid = total > 0;
          const isFull = monthlyFee > 0 ? total >= monthlyFee : isPaid;
          const tone = !isPaid ? 'belum' : isFull ? 'lunas' : 'sebagian';

          const toneClass = {
            belum: 'border-red-200 bg-red-50/70',
            sebagian: 'border-amber-200 bg-amber-50/70',
            lunas: 'border-school-200 bg-school-50/70',
          }[tone];

          const textClass = {
            belum: 'text-red-800',
            sebagian: 'text-amber-800',
            lunas: 'text-school-800',
          }[tone];

          const subClass = {
            belum: 'text-red-500',
            sebagian: 'text-amber-600',
            lunas: 'text-school-700',
          }[tone];

          const Icon = {
            belum: CircleDashed,
            sebagian: CircleDollarSign,
            lunas: CheckCircle2,
          }[tone];

          return (
            <div
              key={month}
              title={
                isPaid
                  ? `${month}: ${formatCurrency(total)}${
                      isFull ? ' (lunas)' : ` dari ${formatCurrency(monthlyFee)}`
                    }`
                  : `${month}: belum dibayar`
              }
              className={cn('rounded-xl border px-3 py-2.5 transition', toneClass)}
            >
              <div className="flex items-center gap-1.5">
                <Icon size={13} className={cn('shrink-0', subClass)} />
                <p className={cn('text-xs font-semibold', textClass)}>{month.slice(0, 3)}</p>
              </div>
              <p className={cn('mt-1 truncate text-[11px] font-medium', subClass)}>
                {isPaid ? formatCurrency(total) : 'Belum bayar'}
              </p>
              {isPaid && !isFull && monthlyFee > 0 && (
                <p className="mt-0.5 truncate text-[10px] text-amber-600/80">
                  kurang {formatCurrency(monthlyFee - total)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PaymentHistory({
  payments,
  studentId,
  monthlyFee = 0,
  title = 'Riwayat Pembayaran',
  emptyTitle = 'Belum Ada Data Pembayaran',
  emptyDescription = 'Belum ada transaksi pembayaran yang tercatat untuk siswa ini.',
  showMonthTracker = true,
  onEdit,
  onDelete,
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(HISTORY_PAGE_SIZES[0]);

  const sorted = useMemo(
    () =>
      [...payments].sort((a, b) => {
        const monthDiff = MONTHS.indexOf(a.bulan) - MONTHS.indexOf(b.bulan);
        if (monthDiff !== 0) return monthDiff;
        return String(a.created_at).localeCompare(String(b.created_at));
      }),
    [payments],
  );

  const total = sorted.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const rows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Kembali ke halaman 1 saat jumlah data menyusut (mis. setelah hapus transaksi).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{payments.length} transaksi tercatat</p>
        </div>
      </div>

      {payments.length === 0 ? (
        <EmptyState icon={Clock} title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          {showMonthTracker && <MonthTracker payments={payments} monthlyFee={monthlyFee} />}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-slate-200 bg-slate-50/70">
                <tr>
                  <th className="table-head">Bulan</th>
                  <th className="table-head text-right">Nominal</th>
                  <th className="table-head">Tanggal Bayar</th>
                  <th className="table-head">Petugas</th>
                  <th className="table-head">Keterangan</th>
                  <th className="table-head text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((payment, index) => (
                  <motion.tr
                    key={payment.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18, delay: index * 0.03 }}
                    className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="table-cell font-medium text-slate-800">{payment.bulan}</td>
                    <td className="table-cell text-right font-semibold text-school-700">
                      {formatCurrency(payment.nominal_bayar)}
                    </td>
                    <td className="table-cell">{formatDate(payment.tanggal_bayar)}</td>
                    <td className="table-cell">{payment.created_by || 'TU'}</td>
                    <td className="table-cell max-w-[240px] truncate text-slate-500">
                      {payment.keterangan || '-'}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(payment)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-amber-50 hover:text-amber-600"
                          title="Edit transaksi"
                          aria-label={`Edit pembayaran ${payment.bulan}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(payment)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                          title="Hapus transaksi"
                          aria-label={`Hapus pembayaran ${payment.bulan}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            pageSizes={HISTORY_PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
}
