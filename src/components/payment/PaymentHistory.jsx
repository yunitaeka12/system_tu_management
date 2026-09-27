import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  CircleDollarSign,
  Clock,
  CalendarRange,
  Pencil,
  Trash2,
} from 'lucide-react';
import EmptyState from '../EmptyState';
import Pagination from '../Pagination';
import { MONTHS, buildMonthlyCoverage } from '../../utils/paymentCalculator';
import { formatCurrency } from '../../utils/currency';
import { formatDate, cn } from '../../utils/helpers';

const HISTORY_PAGE_SIZES = [5, 10, 50];

/**
 * Peta pembayaran bulanan gabungan (SPP + ekskul) dengan pembeda warna:
 * - merah  : belum dibayar sama sekali (SPP maupun ekskul)
 * - kuning : sudah dibayar sebagian, atau salah satu (SPP / ekskul) belum lunas
 * - hijau  : SPP bulan tsb DAN seluruh ekskul yang diikuti sudah lunas
 *
 * Ekskul tanpa total tahunan, jadi kelunasannya dinilai per biaya bulanan.
 */
function MonthTracker({ payments, monthlyFee, enrollments }) {
  const coverage = useMemo(
    () => buildMonthlyCoverage(payments, monthlyFee),
    [payments, monthlyFee],
  );

  return (
    <div className="border-b border-slate-200 px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
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
            SPP + ekskul lunas
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MONTHS.map((month, monthIndex) => {
          const cov = coverage[monthIndex];
          const sppTotal = cov.covered;
          const sppPaid = cov.covered > 0;
          const sppFull = cov.isFull;

          const items = enrollments.map((enrollment) => {
            const fee = Number(enrollment.monthlyFee) || 0;
            const paid = (enrollment.payments || [])
              .filter((payment) => payment.bulan === month)
              .reduce((sum, payment) => sum + Number(payment.nominal_bayar || 0), 0);
            return { nama: enrollment.ekskul_nama, fee, paid };
          });
          const ekskulPaidAny = items.some((item) => item.paid > 0);
          const ekskulFull = items.every((item) =>
            item.fee > 0 ? item.paid >= item.fee : item.paid > 0,
          );

          const tone =
            !sppPaid && !ekskulPaidAny ? 'belum' : sppFull && ekskulFull ? 'lunas' : 'sebagian';

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

          const tooltip = [
            `${month}`,
            `SPP: ${sppPaid ? formatCurrency(sppTotal) : 'belum bayar'}${
              cov.carryOut > 0 ? ` (+${formatCurrency(cov.carryOut)} ke bulan berikutnya)` : ''
            }`,
            ...items.map(
              (item) =>
                `${item.nama}: ${item.paid > 0 ? formatCurrency(item.paid) : 'belum bayar'}`,
            ),
          ].join(' • ');

          return (
            <div
              key={month}
              title={tooltip}
              className={cn('rounded-xl border px-3 py-2.5 transition', toneClass)}
            >
              <div className="flex items-center gap-1.5">
                <Icon size={13} className={cn('shrink-0', subClass)} />
                <p className={cn('text-xs font-semibold', textClass)}>{month}</p>
              </div>
              <p className={cn('mt-1 truncate text-[11px] font-medium', subClass)}>
                {sppPaid ? formatCurrency(sppTotal) : 'Belum bayar'}
              </p>

              {items.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {items.map((item) => (
                    <p
                      key={item.nama}
                      className={cn(
                        'truncate text-[10px]',
                        item.paid > 0 ? subClass : 'text-slate-400',
                      )}
                    >
                      {item.nama}: {item.paid > 0 ? formatCurrency(item.paid) : 'belum'}
                    </p>
                  ))}
                </div>
              )}

              {sppPaid && !sppFull && monthlyFee > 0 && (
                <p className="mt-0.5 truncate text-[10px] text-amber-600/80">
                  kurang {formatCurrency(cov.shortfall)}
                </p>
              )}
              {cov.carryOut > 0 && monthlyFee > 0 && (
                <p className="mt-0.5 truncate text-[10px] text-school-600">
                  lebih {formatCurrency(cov.carryOut)} → bulan berikutnya
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
  payments = [],
  studentId,
  monthlyFee = 0,
  enrollments = [],
  title = 'Riwayat Pembayaran',
  emptyTitle = 'Belum Ada Data Pembayaran',
  emptyDescription = 'Belum ada transaksi pembayaran yang tercatat untuk siswa ini.',
  showMonthTracker = true,
  onEdit,
  onDelete,
  onEditEkskul,
  onDeleteEkskul,
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(HISTORY_PAGE_SIZES[0]);
  const [mapOpen, setMapOpen] = useState(false);

  // Gabungkan transaksi SPP dan transaksi ekskul menjadi satu riwayat.
  const entries = useMemo(() => {
    const spp = payments.map((payment) => ({
      key: `spp-${payment.id}`,
      kind: 'spp',
      bulan: payment.bulan,
      nominal: payment.nominal_bayar,
      tanggal: payment.tanggal_bayar,
      petugas: payment.created_by,
      keterangan: payment.keterangan,
      created_at: payment.created_at,
      raw: payment,
    }));

    const ekskul = [];
    enrollments.forEach((enrollment) => {
      (enrollment.payments || []).forEach((payment) => {
        ekskul.push({
          key: `eks-${payment.id}`,
          kind: 'ekskul',
          ekskul_nama: enrollment.ekskul_nama,
          enrollment,
          bulan: payment.bulan,
          nominal: payment.nominal_bayar,
          tanggal: payment.tanggal_bayar,
          petugas: payment.created_by,
          keterangan: payment.keterangan,
          created_at: payment.created_at,
          raw: payment,
        });
      });
    });

    return [...spp, ...ekskul].sort((a, b) => {
      const monthDiff = MONTHS.indexOf(a.bulan) - MONTHS.indexOf(b.bulan);
      if (monthDiff !== 0) return monthDiff;
      return String(a.created_at).localeCompare(String(b.created_at));
    });
  }, [payments, enrollments]);

  const total = entries.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const rows = entries.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Kembali ke halaman 1 saat jumlah data menyusut (mis. setelah hapus transaksi).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{total} transaksi tercatat</p>
        </div>
        {showMonthTracker && total > 0 && (
          <button
            type="button"
            onClick={() => setMapOpen((v) => !v)}
            aria-expanded={mapOpen}
            className="btn-secondary btn-sm"
          >
            <CalendarRange size={15} />
            Peta Bulanan
            <ChevronDown
              size={15}
              className={cn('transition-transform duration-200', mapOpen && 'rotate-180')}
            />
          </button>
        )}
      </div>

      {total === 0 ? (
        <EmptyState icon={Clock} title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          {showMonthTracker && (
            <AnimatePresence initial={false}>
              {mapOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <MonthTracker
                    payments={payments}
                    monthlyFee={monthlyFee}
                    enrollments={enrollments}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="table-head">Bulan</th>
                  <th className="table-head">Jenis</th>
                  <th className="table-head text-right">Nominal</th>
                  <th className="table-head">Tanggal Bayar</th>
                  <th className="table-head">Petugas</th>
                  <th className="table-head">Keterangan</th>
                  <th className="table-head text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry, index) => (
                  <motion.tr
                    key={entry.key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18, delay: index * 0.03 }}
                    className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50"
                  >
                    <td className="table-cell font-medium text-slate-800">{entry.bulan}</td>
                    <td className="table-cell">
                      {entry.kind === 'spp' ? (
                        <span className="badge bg-slate-100 text-slate-600">SPP</span>
                      ) : (
                        <span className="badge bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                          {entry.ekskul_nama}
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-right font-semibold text-school-700">
                      {formatCurrency(entry.nominal)}
                    </td>
                    <td className="table-cell">{formatDate(entry.tanggal)}</td>
                    <td className="table-cell">{entry.petugas || 'TU'}</td>
                    <td className="table-cell max-w-[240px] truncate text-slate-500">
                      {entry.keterangan || '-'}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            entry.kind === 'spp'
                              ? onEdit?.(entry.raw)
                              : onEditEkskul?.({ enrollment: entry.enrollment, payment: entry.raw })
                          }
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-amber-50 hover:text-amber-600"
                          title="Edit transaksi"
                          aria-label={`Edit pembayaran ${entry.bulan}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            entry.kind === 'spp'
                              ? onDelete?.(entry.raw)
                              : onDeleteEkskul?.(entry.raw)
                          }
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                          title="Hapus transaksi"
                          aria-label={`Hapus pembayaran ${entry.bulan}`}
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
