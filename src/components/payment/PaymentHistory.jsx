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
import Select from '../Select';
import {
  PERIOD_MONTHS,
  buildMonthlyCoverage,
  filterByPeriod,
  isOtherPayment,
  listStudentPeriods,
  monthsOfPeriod,
  periodFromStart,
} from '../../utils/paymentCalculator';
import { adjustmentPeriod, monthsOf } from '../../services/adjustmentService';
import { formatCurrency } from '../../utils/currency';
import { formatDate, cn } from '../../utils/helpers';

const HISTORY_PAGE_SIZES = [5, 10, 50];

/**
 * Peta pembayaran bulanan gabungan (SPP + ekskul) untuk satu periode tahun
 * ajaran (Juli–Juni) dengan pembeda warna:
 * - merah  : belum dibayar sama sekali (SPP maupun ekskul)
 * - kuning : sudah dibayar sebagian, atau salah satu (SPP / ekskul) belum lunas
 * - hijau  : SPP bulan tsb DAN seluruh ekskul yang diikuti sudah lunas
 *
 * Nama bulan mengikuti periode terpilih, mis. "Juli 2025" … "Juni 2026".
 * Ekskul tanpa total tahunan, jadi kelunasannya dinilai per biaya bulanan.
 */
function MonthTracker({
  payments,
  monthlyFee,
  enrollments,
  otherPayments = [],
  adjustedMonths = [],
  months = [],
}) {
  const monthOrder = useMemo(() => months.map((item) => item.bulan), [months]);
  const coverage = useMemo(
    () =>
      buildMonthlyCoverage(payments, monthlyFee, null, adjustedMonths, {
        monthOrder: monthOrder.length ? monthOrder : PERIOD_MONTHS,
      }),
    [payments, monthlyFee, adjustedMonths, monthOrder],
  );
  const coverageByMonth = useMemo(
    () => new Map(coverage.map((row) => [row.bulan, row])),
    [coverage],
  );
  const adjustedSet = useMemo(() => new Set(adjustedMonths), [adjustedMonths]);

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
        {months.map((item) => {
          const { bulan, tahun, label } = item;
          const cov = coverageByMonth.get(bulan) ?? {
            covered: 0,
            isFull: false,
            shortfall: monthlyFee,
            carryOut: 0,
            paid: 0,
          };
          const sppTotal = cov.covered;
          const sppPaid = cov.covered > 0;
          const sppFull = cov.isFull;
          // Bulan yang dicentang pada Adjustment langsung lunas (hijau) —
          // seluruh tagihan bulan itu dianggap sudah tercatat di pembukuan
          // sebelumnya, termasuk ekskulnya.
          const adjusted = adjustedSet.has(bulan);

          const items = enrollments.map((enrollment) => {
            const fee = Number(enrollment.monthlyFee) || 0;
            const paid = (enrollment.payments || [])
              .filter((payment) => payment.bulan === bulan)
              .reduce((sum, payment) => sum + Number(payment.nominal_bayar || 0), 0);
            return { nama: enrollment.ekskul_nama, fee, paid };
          });
          // Pembayaran lain-lain bulan ini (tidak dihitung sebagai SPP).
          const otherItems = otherPayments
            .filter((payment) => payment.bulan === bulan)
            .map((payment) => ({
              nama: payment.keterangan || 'Lain-lain',
              nominal: Number(payment.nominal_bayar) || 0,
            }));
          const ekskulPaidAny = items.some((entry) => entry.paid > 0);
          const ekskulFull = items.every((entry) =>
            entry.fee > 0 ? entry.paid >= entry.fee : entry.paid > 0,
          );

          const tone = adjusted
            ? 'lunas'
            : !sppPaid && !ekskulPaidAny
              ? 'belum'
              : sppFull && ekskulFull
                ? 'lunas'
                : 'sebagian';

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
            `${label}`,
            `SPP: ${sppPaid ? formatCurrency(sppTotal) : 'belum bayar'}${
              cov.carryOut > 0 ? ` (+${formatCurrency(cov.carryOut)} ke bulan berikutnya)` : ''
            }`,
            ...(adjusted
              ? ['Adjustment: lunas (tercatat di pembukuan sebelumnya)']
              : items.map(
                  (entry) =>
                    `${entry.nama}: ${entry.paid > 0 ? formatCurrency(entry.paid) : 'belum bayar'}`,
                )),
          ].join(' • ');

          return (
            <div
              key={label}
              title={tooltip}
              className={cn('rounded-xl border px-3 py-2.5 transition', toneClass)}
            >
              <div className="flex items-baseline gap-1.5">
                <Icon size={13} className={cn('shrink-0 translate-y-[2px]', subClass)} />
                <p className={cn('text-xs font-semibold', textClass)}>{bulan}</p>
                <span className={cn('ml-auto text-[10px] font-medium tabular-nums', subClass)}>
                  {tahun}
                </span>
              </div>
              <p className={cn('mt-1 truncate text-[11px] font-medium', subClass)}>
                {sppPaid ? formatCurrency(sppTotal) : 'Belum bayar'}
              </p>

              {adjusted ? (
                <p className="mt-1 truncate text-[10px] text-school-700">
                  adjustment • lunas
                </p>
              ) : (
                items.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {items.map((entry) => (
                      <p
                        key={entry.nama}
                        className={cn(
                          'truncate text-[10px]',
                          entry.paid > 0 ? subClass : 'text-slate-400',
                        )}
                      >
                        {entry.nama}: {entry.paid > 0 ? formatCurrency(entry.paid) : 'belum'}
                      </p>
                    ))}
                  </div>
                )
              )}

              {otherItems.map((entry, index) => (
                <p
                  key={`${entry.nama}-${index}`}
                  className="mt-0.5 truncate text-[10px] font-medium text-primary-600"
                  title={`${entry.nama}: ${formatCurrency(entry.nominal)}`}
                >
                  {entry.nama}: {formatCurrency(entry.nominal)}
                </p>
              ))}

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
  noInduk = '',
  monthlyFee = 0,
  enrollments = [],
  adjustments = [],
  title = 'Riwayat Pembayaran',
  emptyTitle = 'Belum Ada Data Pembayaran',
  emptyDescription = 'Belum ada transaksi pembayaran yang tercatat untuk siswa ini.',
  showMonthTracker = true,
  // Periode tahun ajaran yang sedang dilihat (tahun mulai, mis. 2025).
  periodStart,
  onPeriodChange,
  onEdit,
  onDelete,
  onEditEkskul,
  onDeleteEkskul,
  onEditAdjustment,
  onDeleteAdjustment,
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(HISTORY_PAGE_SIZES[0]);
  const [mapOpen, setMapOpen] = useState(false);

  // Seluruh transaksi (SPP + ekskul + adjustment) dari semua periode — dipakai
  // untuk menyusun daftar pilihan periode tahun ajaran.
  const periodSources = useMemo(
    () => [
      ...payments,
      ...enrollments.flatMap((enrollment) => enrollment.payments || []),
      ...adjustments.flatMap((row) => {
        const start = adjustmentPeriod(row);
        const periodMonths = monthsOfPeriod(start);
        return monthsOf(row).map((month) => ({
          bulan: month,
          tahun: periodMonths.find((item) => item.bulan === month)?.tahun ?? start,
        }));
      }),
    ],
    [payments, enrollments, adjustments],
  );
  const periods = useMemo(
    () => listStudentPeriods(noInduk, periodSources),
    [noInduk, periodSources],
  );

  const period = useMemo(
    () => periodFromStart(periodStart) ?? periods[0] ?? null,
    [periodStart, periods],
  );
  const activeStart = period?.start ?? null;
  const months = useMemo(() => monthsOfPeriod(activeStart), [activeStart]);

  // Peta bulanan & riwayat selalu ditampilkan untuk satu periode tahun ajaran
  // saja — kalau tidak, bulan yang sama pada periode berbeda akan tercampur.
  const visiblePayments = useMemo(
    () => filterByPeriod(payments, activeStart),
    [payments, activeStart],
  );
  // Hanya pembayaran SPP yang mempengaruhi kelunasan bulan.
  const sppPayments = useMemo(
    () => visiblePayments.filter((payment) => !isOtherPayment(payment)),
    [visiblePayments],
  );
  const otherPayments = useMemo(
    () => visiblePayments.filter(isOtherPayment),
    [visiblePayments],
  );
  const visibleEnrollments = useMemo(
    () =>
      enrollments.map((enrollment) => ({
        ...enrollment,
        payments: filterByPeriod(enrollment.payments || [], activeStart),
      })),
    [enrollments, activeStart],
  );
  const visibleAdjustments = useMemo(
    () => adjustments.filter((row) => adjustmentPeriod(row) === activeStart),
    [adjustments, activeStart],
  );
  const adjustedMonths = useMemo(() => {
    const found = new Set();
    visibleAdjustments.forEach((row) => monthsOf(row).forEach((month) => found.add(month)));
    return PERIOD_MONTHS.filter((month) => found.has(month));
  }, [visibleAdjustments]);

  /** Label bulan + tahun (mis. "Juli 2025") sesuai periode terpilih. */
  const monthLabel = useMemo(() => {
    const map = new Map(months.map((item) => [item.bulan, item.label]));
    return (bulan, tahun) => map.get(bulan) ?? `${bulan} ${tahun ?? ''}`.trim();
  }, [months]);

  // Gabungkan transaksi SPP dan transaksi ekskul menjadi satu riwayat.
  const entries = useMemo(() => {
    const spp = sppPayments.map((payment) => ({
      key: `spp-${payment.id}`,
      kind: 'spp',
      bulan: monthLabel(payment.bulan, payment.tahun),
      sortMonth: payment.bulan,
      nominal: payment.nominal_bayar,
      tanggal: payment.tanggal_bayar,
      petugas: payment.created_by,
      keterangan: payment.keterangan,
      created_at: payment.created_at,
      raw: payment,
    }));

    // Pembayaran lain-lain: tercatat di riwayat tetapi bukan pelunasan SPP.
    const lain = otherPayments.map((payment) => ({
      key: `lain-${payment.id}`,
      kind: 'lain',
      bulan: monthLabel(payment.bulan, payment.tahun),
      sortMonth: payment.bulan,
      nominal: payment.nominal_bayar,
      tanggal: payment.tanggal_bayar,
      petugas: payment.created_by,
      keterangan: payment.keterangan,
      created_at: payment.created_at,
      raw: payment,
    }));

    const ekskul = [];
    visibleEnrollments.forEach((enrollment) => {
      (enrollment.payments || []).forEach((payment) => {
        ekskul.push({
          key: `eks-${payment.id}`,
          kind: 'ekskul',
          ekskul_nama: enrollment.ekskul_nama,
          enrollment,
          bulan: monthLabel(payment.bulan, payment.tahun),
          sortMonth: payment.bulan,
          nominal: payment.nominal_bayar,
          tanggal: payment.tanggal_bayar,
          petugas: payment.created_by,
          keterangan: payment.keterangan,
          created_at: payment.created_at,
          raw: payment,
        });
      });
    });

    // Adjustment: satu baris mewakili beberapa bulan yang dicentang.
    const adjustment = visibleAdjustments.map((row) => {
      const list = monthsOf(row);
      return {
        key: `adj-${row.id}`,
        kind: 'adjustment',
        bulan:
          list.length === PERIOD_MONTHS.length
            ? 'Seluruh periode'
            : list.map((month) => monthLabel(month)).join(', ') || '-',
        sortMonth: list[0] ?? PERIOD_MONTHS[0],
        nominal: row.nominal,
        tanggal: row.created_at ? String(row.created_at).slice(0, 10) : null,
        petugas: row.created_by,
        keterangan: row.keterangan,
        created_at: row.created_at,
        raw: row,
      };
    });

    return [...spp, ...lain, ...ekskul, ...adjustment].sort((a, b) => {
      const monthDiff =
        PERIOD_MONTHS.indexOf(a.sortMonth) - PERIOD_MONTHS.indexOf(b.sortMonth);
      if (monthDiff !== 0) return monthDiff;
      return String(a.created_at).localeCompare(String(b.created_at));
    });
  }, [sppPayments, otherPayments, visibleEnrollments, visibleAdjustments, monthLabel]);

  const total = entries.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const rows = entries.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Kembali ke halaman 1 saat jumlah data menyusut (mis. setelah hapus transaksi).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Kembali ke halaman 1 saat periode yang ditampilkan berganti.
  useEffect(() => {
    setPage(1);
  }, [activeStart]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {total} transaksi tercatat
            {period && ` • periode ${period.display}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {periods.length > 0 && (
            <Select
              value={activeStart}
              onChange={(event) => onPeriodChange?.(Number(event.target.value))}
              ariaLabel="Filter periode tahun ajaran"
              className="w-[190px] rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            >
              {periods.map((option) => (
                <option key={option.start} value={option.start}>
                  {option.display}
                </option>
              ))}
            </Select>
          )}
          {showMonthTracker && (
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
      </div>

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
                payments={sppPayments}
                monthlyFee={monthlyFee}
                enrollments={visibleEnrollments}
                otherPayments={otherPayments}
                adjustedMonths={adjustedMonths}
                months={months}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {total === 0 ? (
        <EmptyState
          icon={Clock}
          title={
            period ? `Tidak Ada Transaksi Periode ${period.label}` : emptyTitle
          }
          description={
            period
              ? 'Pilih periode tahun ajaran lain pada filter di atas untuk melihat riwayat transaksi.'
              : emptyDescription
          }
        />
      ) : (
        <>
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
                    <td className="table-cell max-w-[220px] truncate font-medium text-slate-800">
                      {entry.bulan}
                    </td>
                    <td className="table-cell">
                      {entry.kind === 'spp' && (
                        <span className="badge bg-slate-100 text-slate-600">SPP</span>
                      )}
                      {entry.kind === 'lain' && (
                        <span className="badge bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                          Pembayaran Lain
                        </span>
                      )}
                      {entry.kind === 'ekskul' && (
                        <span className="badge bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                          {entry.ekskul_nama}
                        </span>
                      )}
                      {entry.kind === 'adjustment' && (
                        <span className="badge bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                          Adjustment
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
                          onClick={() => {
                            if (entry.kind === 'spp' || entry.kind === 'lain') onEdit?.(entry.raw);
                            else if (entry.kind === 'ekskul')
                              onEditEkskul?.({ enrollment: entry.enrollment, payment: entry.raw });
                            else onEditAdjustment?.(entry.raw);
                          }}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-amber-50 hover:text-amber-600"
                          title="Edit transaksi"
                          aria-label={`Edit pembayaran ${entry.bulan}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (entry.kind === 'spp' || entry.kind === 'lain') onDelete?.(entry.raw);
                            else if (entry.kind === 'ekskul') onDeleteEkskul?.(entry.raw);
                            else onDeleteAdjustment?.(entry.raw);
                          }}
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
