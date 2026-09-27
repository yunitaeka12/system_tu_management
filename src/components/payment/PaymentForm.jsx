import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  CalendarDays,
  Info,
  Loader2,
  Plus,
  Save,
  Wallet,
  X,
} from 'lucide-react';
import FormField from '../FormField';
import Select from '../Select';
import PaymentStatusBadge from '../PaymentStatusBadge';
import {
  PERIOD_MONTHS,
  buildMonthlyCoverage,
  currentPeriodStart,
  getAnnualFee,
  getMonthlyFee,
  getPaymentStatus,
  isOtherPayment,
  monthsOfPeriod,
  periodFromStart,
} from '../../utils/paymentCalculator';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '../../utils/currency';
import { cn, uid } from '../../utils/helpers';

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Form pembayaran yang dipakai bersama oleh halaman Add Pembayaran
 * maupun modal Edit Pembayaran.
 *
 * Data siswa (nama, no induk, NISN, kelas, total tagihan) bersifat
 * read-only dan otomatis diambil dari Buku Induk.
 */
export default function PaymentForm({
  student,
  initialValues = null,
  excludePaymentId = null,
  preview,
  payments = [],
  enrollments = [],
  // Bulan yang sudah lunas karena Adjustment (pembukuan sebelumnya).
  adjustedMonths = [],
  // Periode tahun ajaran tempat pembayaran dicatat (tahun mulai, mis. 2025).
  periodStart = currentPeriodStart(),
  // Total tagihan seluruh periode (dari ringkasan siswa). Bila kosong, dipakai
  // tagihan satu periode.
  totalBilled = null,
  showEkskul = false,
  ekskulOptions = [],
  // Bagian pembayaran lain-lain: dimatikan saat modal Edit satu transaksi
  // karena pembayaran lain dicatat lewat halaman Add Pembayaran.
  showLain = true,
  submitting = false,
  onSubmit,
  onCancel,
  submitLabel = 'Simpan Pembayaran',
}) {
  const monthlyFee = getMonthlyFee(student?.no_induk);
  const annualFee = Number(totalBilled) || getAnnualFee(student?.no_induk);
  const period = periodFromStart(periodStart);
  // Bulan mengikuti periode yang dipilih — labelnya ikut menyebut tahunnya.
  const periodMonths = useMemo(() => monthsOfPeriod(periodStart), [periodStart]);

  const [bulan, setBulan] = useState(initialValues?.bulan ?? '');
  const [nominal, setNominal] = useState(
    initialValues ? String(initialValues.nominal_bayar) : String(monthlyFee),
  );
  const [tanggalBayar, setTanggalBayar] = useState(
    initialValues?.tanggal_bayar ?? todayISO(),
  );
  const [keterangan, setKeterangan] = useState(initialValues?.keterangan ?? '');
  const [ekskulNama, setEkskulNama] = useState(initialValues?.ekskul_nama ?? '');
  const [ekskulNominal, setEkskulNominal] = useState(
    initialValues?.ekskul_nominal ? String(initialValues.ekskul_nominal) : '',
  );
  // Pembayaran lain-lain (opsional) — tidak mengurangi tagihan SPP.
  // Boleh lebih dari satu baris; tiap baris disimpan sebagai transaksi sendiri.
  const [lainRows, setLainRows] = useState([]);
  const [error, setError] = useState('');

  const amount = parseCurrencyInput(nominal);
  const ekskulAmount = parseCurrencyInput(ekskulNominal);
  const lainAmount = lainRows.reduce((sum, row) => sum + parseCurrencyInput(row.nominal), 0);
  const selectedEkskul = ekskulOptions.find((item) => item.nama === ekskulNama) || null;

  // Pilih ekskul → nominal otomatis mengikuti biaya bulanannya.
  const handleEkskulChange = (value) => {
    setEkskulNama(value);
    const found = ekskulOptions.find((item) => item.nama === value);
    setEkskulNominal(found ? String(found.biaya) : '');
  };

  // Baris pembayaran lain-lain: tambah / ubah / hapus.
  const addLainRow = () =>
    setLainRows((rows) => [...rows, { id: uid('lain'), nominal: '', keterangan: '' }]);

  const updateLainRow = (id, patch) =>
    setLainRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const removeLainRow = (id) => setLainRows((rows) => rows.filter((row) => row.id !== id));

  // Pratinjau dihitung ulang setiap nominal / bulan berubah.
  const previewData = useMemo(
    () => (preview ? preview({ bulan, nominal: amount }) : null),
    [preview, bulan, amount],
  );

  const projectedTotal = previewData?.projectedTotal ?? 0;
  const projectedStatus = getPaymentStatus(projectedTotal, annualFee);
  const projectedRemaining = Math.max(annualFee - projectedTotal, 0);

  // Sebar pembayaran ke bulan secara berurutan (kelebihan menutup bulan berikutnya).
  // Pembayaran lain-lain tidak dihitung sebagai pelunasan SPP.
  const existingPayments = useMemo(
    () =>
      payments.filter(
        (payment) => payment.id !== excludePaymentId && !isOtherPayment(payment),
      ),
    [payments, excludePaymentId],
  );
  const coverage = useMemo(
    () =>
      buildMonthlyCoverage(existingPayments, monthlyFee, null, adjustedMonths, {
        monthOrder: PERIOD_MONTHS,
      }),
    [existingPayments, monthlyFee, adjustedMonths],
  );
  const projectedCoverage = useMemo(
    () =>
      buildMonthlyCoverage(
        existingPayments,
        monthlyFee,
        bulan && amount > 0 ? { bulan, nominal: amount } : null,
        adjustedMonths,
        { monthOrder: PERIOD_MONTHS },
      ),
    [existingPayments, monthlyFee, bulan, amount, adjustedMonths],
  );

  const monthIndex = PERIOD_MONTHS.indexOf(bulan);
  const monthCoverage = monthIndex >= 0 ? coverage[monthIndex] : null;
  const newlyCovered = useMemo(
    () =>
      bulan
        ? projectedCoverage
            .filter((row, index) => row.isFull && !coverage[index].isFull)
            .map((row) => row.bulan)
        : [],
    [projectedCoverage, coverage, bulan],
  );

  // Pembayaran ekskul yang sudah tercatat pada bulan terpilih.
  const ekskulThisMonth = useMemo(() => {
    if (!bulan) return [];
    const list = [];
    enrollments.forEach((enrollment) => {
      (enrollment.payments || []).forEach((payment) => {
        if (payment.bulan === bulan) {
          list.push({
            nama: enrollment.ekskul_nama,
            nominal: Number(payment.nominal_bayar) || 0,
          });
        }
      });
    });
    return list;
  }, [enrollments, bulan]);

  const ekskulDuplicate = ekskulNama
    ? ekskulThisMonth.filter((item) => item.nama === ekskulNama)
    : [];

  // Keterangan otomatis mengikuti status pembayaran — tetap bisa diubah.
  const [keteranganTouched, setKeteranganTouched] = useState(Boolean(initialValues?.keterangan));

  useEffect(() => {
    if (keteranganTouched) return;
    if (!bulan) return;
    if (projectedStatus === 'lunas') setKeterangan('LUNAS');
    else if (projectedStatus === 'sebagian') {
      setKeterangan(`Belum Lunas - Sisa ${formatCurrency(projectedRemaining)}`);
    } else {
      setKeterangan('Terbayar');
    }
  }, [projectedStatus, projectedRemaining, bulan, keteranganTouched]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!bulan) {
      setError('Bulan pembayaran wajib dipilih.');
      return;
    }
    if (amount <= 0) {
      setError('Nominal pembayaran harus lebih dari 0.');
      return;
    }
    setError('');
    onSubmit({
      bulan,
      nominal: amount,
      // Tahun diambil dari periode agar bulan Januari–Juni jatuh pada tahun
      // yang benar (mis. Januari di periode 2025/2026 → 2026).
      tahun:
        initialValues?.tahun ??
        periodMonths.find((item) => item.bulan === bulan)?.tahun ??
        new Date().getFullYear(),
      tanggalBayar,
      keterangan,
      excludePaymentId,
      ekskulNama,
      ekskulNominal: ekskulNama ? ekskulAmount : 0,
      // Baris pembayaran lain yang nominalnya terisi (> 0) saja yang disimpan.
      lainItems: lainRows
        .map((row) => ({
          nominal: parseCurrencyInput(row.nominal),
          keterangan: row.keterangan.trim(),
        }))
        .filter((item) => item.nominal > 0),
    });
  };

  const duplicate = previewData?.duplicate;
  const isOverpay = previewData?.isOverpay;

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Data siswa — read only */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Data Siswa (otomatis dari Buku Induk)
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {[
            { label: 'Nama Lengkap', value: student?.nama_lengkap },
            { label: 'No Induk', value: student?.no_induk },
            { label: 'NISN', value: student?.nisn || '-' },
            { label: 'Kelas', value: student?.kelas },
          ].map((item) => (
            <div key={item.label} className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {item.label}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Total Tagihan
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-800">{formatCurrency(annualFee)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Tagihan Bulanan
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-800">{formatCurrency(monthlyFee)}</p>
          </div>
          <div className="col-span-2 border-t border-slate-200 pt-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Periode Tahun Ajaran
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-800">
              {period ? period.display : '-'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Bulan Bayar" htmlFor="bulan" required>
          <div className="relative">
            <CalendarDays
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Select
              id="bulan"
              value={bulan}
              onChange={(e) => setBulan(e.target.value)}
              className="input pl-10"
            >
              <option value="">Pilih Bulan</option>
              {periodMonths.map((item) => (
                <option key={item.label} value={item.bulan}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
        </FormField>

        <FormField label="Nominal Bayar" htmlFor="nominal" required hint={formatCurrency(amount)}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
              Rp
            </span>
            <input
              id="nominal"
              type="text"
              inputMode="numeric"
              value={formatCurrencyInput(nominal)}
              onChange={(e) => setNominal(String(parseCurrencyInput(e.target.value)))}
              placeholder="260.000"
              className="input pl-10 font-semibold"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setNominal(String(monthlyFee))}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-primary-300 hover:text-primary-600"
            >
              {formatCurrency(monthlyFee)} (1 bulan)
            </button>
            {bulan && monthCoverage && !monthCoverage.isFull && (
              <button
                type="button"
                onClick={() => setNominal(String(monthCoverage.shortfall))}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-primary-300 hover:text-primary-600"
              >
                Lunasi bulan {bulan} ({formatCurrency(monthCoverage.shortfall)})
              </button>
            )}
            {projectedRemaining > 0 && (
              <button
                type="button"
                onClick={() => setNominal(String(projectedRemaining))}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-primary-300 hover:text-primary-600"
              >
                Lunasi seluruh sisa ({formatCurrency(projectedRemaining)})
              </button>
            )}
          </div>
        </FormField>

        <FormField label="Tanggal Bayar" htmlFor="tanggal_bayar">
          <input
            id="tanggal_bayar"
            type="date"
            value={tanggalBayar}
            onChange={(e) => setTanggalBayar(e.target.value)}
            className="input"
          />
        </FormField>

        <FormField label="Keterangan" htmlFor="keterangan" hint="Otomatis mengikuti status, bisa diubah">
          <input
            id="keterangan"
            type="text"
            value={keterangan}
            onChange={(e) => {
              setKeteranganTouched(true);
              setKeterangan(e.target.value);
            }}
            placeholder="Terbayar"
            className="input"
          />
        </FormField>
      </div>

      {/* Status bulan terpilih — lunas/sisa + bulan yang ikut tertutup */}
      {bulan && monthCoverage && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <CalendarDays size={14} />
            Status Bulan {bulan}
            {period ? <span className="font-medium normal-case">• {period.label}</span> : null}
          </p>
          <p
            className={cn(
              'text-sm font-medium',
              monthCoverage.isFull ? 'text-school-700' : 'text-amber-700',
            )}
          >
            {monthCoverage.isFull
              ? 'Sudah lunas'
              : `Belum lunas — kurang ${formatCurrency(monthCoverage.shortfall)}`}
            <span className="font-normal text-slate-500">
              {' '}
              • terbayar {formatCurrency(monthCoverage.covered)}
            </span>
          </p>
          {amount > 0 && newlyCovered.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Nominal ini menutup bulan:{' '}
              <strong className="text-slate-700">{newlyCovered.join(', ')}</strong>.
            </p>
          )}
        </div>
      )}

      {/* Ekskul opsional — pembayaran ekskul ikut dicatat bersama SPP */}
      {showEkskul && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Award size={15} className="text-primary-600" />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Pembayaran Ekskul (opsional)
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Pilih Ekskul" htmlFor="ekskul_nama" hint="Kosongkan bila tidak ada">
              <Select
                id="ekskul_nama"
                value={ekskulNama}
                onChange={(e) => handleEkskulChange(e.target.value)}
                className="input"
              >
                <option value="">Tidak ada pembayaran ekskul</option>
                {ekskulOptions.map((item) => (
                  <option key={item.nama} value={item.nama}>
                    {item.nama} — {formatCurrency(item.biaya)}/bulan
                  </option>
                ))}
              </Select>
            </FormField>

            {selectedEkskul && (
              <FormField
                label="Nominal Bayar Ekskul"
                htmlFor="ekskul_nominal"
                hint={formatCurrency(ekskulAmount)}
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                    Rp
                  </span>
                  <input
                    id="ekskul_nominal"
                    type="text"
                    inputMode="numeric"
                    value={formatCurrencyInput(ekskulNominal)}
                    onChange={(e) => setEkskulNominal(String(parseCurrencyInput(e.target.value)))}
                    placeholder={formatCurrency(selectedEkskul.biaya, { withSymbol: false })}
                    className="input pl-10 font-semibold"
                  />
                </div>
              </FormField>
            )}
          </div>
          {selectedEkskul && (
            <p className="mt-3 rounded-lg border border-primary-100 bg-primary-50/60 px-3.5 py-2.5 text-xs text-primary-800">
              Biaya bulanan ekskul {selectedEkskul.nama} sebesar{' '}
              <strong>{formatCurrency(selectedEkskul.biaya)}</strong>. Bila siswa belum terdaftar,
              otomatis didaftarkan saat menyimpan.
            </p>
          )}
          {bulan && ekskulThisMonth.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
              <p className="font-semibold">Bulan {bulan} sudah ada pembayaran ekskul:</p>
              <ul className="mt-1 space-y-0.5">
                {ekskulThisMonth.map((item, index) => (
                  <li key={`${item.nama}-${index}`}>
                    • {item.nama} sebesar {formatCurrency(item.nominal)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ekskulDuplicate.length > 0 && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Ekskul {ekskulNama} bulan {bulan} sudah pernah dibayar — konfirmasi akan diminta saat
              menyimpan.
            </p>
          )}
        </div>
      )}

      {/* Pembayaran lain-lain — opsional, tidak mengurangi tagihan SPP */}
      {showLain && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Pembayaran Lain
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Untuk pembayaran di luar SPP (seragam, kegiatan, dll.) — tercatat di peta bulanan &
                riwayat, tanpa mengurangi tagihan SPP. Bisa diisi lebih dari satu.
              </p>
            </div>
            {lainAmount > 0 && (
              <span className="badge bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                Total {formatCurrency(lainAmount)}
              </span>
            )}
          </div>

          {lainRows.length > 0 && (
            <div className="mt-3 space-y-3">
              {lainRows.map((row, index) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Pembayaran Lain #{index + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeLainRow(row.id)}
                      className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                      aria-label={`Hapus pembayaran lain #${index + 1}`}
                    >
                      <X size={14} />
                      Hapus
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      label="Nominal Pembayaran Lain"
                      htmlFor={`lain_nominal_${row.id}`}
                      hint={
                        parseCurrencyInput(row.nominal) > 0
                          ? formatCurrency(parseCurrencyInput(row.nominal))
                          : 'Di luar tagihan SPP'
                      }
                    >
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                          Rp
                        </span>
                        <input
                          id={`lain_nominal_${row.id}`}
                          type="text"
                          inputMode="numeric"
                          value={formatCurrencyInput(row.nominal)}
                          onChange={(e) =>
                            updateLainRow(row.id, {
                              nominal: String(parseCurrencyInput(e.target.value)),
                            })
                          }
                          placeholder="0"
                          className="input pl-10 font-semibold"
                        />
                      </div>
                    </FormField>

                    <FormField
                      label="Keterangan Pembayaran"
                      htmlFor={`lain_keterangan_${row.id}`}
                    >
                      <input
                        id={`lain_keterangan_${row.id}`}
                        type="text"
                        value={row.keterangan}
                        onChange={(e) => updateLainRow(row.id, { keterangan: e.target.value })}
                        placeholder="mis. Seragam olahraga"
                        className="input"
                      />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={addLainRow} className="btn-secondary btn-sm mt-3">
            <Plus size={15} />
            Pembayaran Lain
          </button>
        </div>
      )}

      {/* Peringatan */}
      <AnimatePresence>
        {duplicate?.hasDuplicate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Pembayaran bulan {bulan} sudah tercatat.</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  {duplicate.count} transaksi dengan total {formatCurrency(duplicate.total)}. Anda
                  tetap dapat menyimpan pembayaran tambahan bila memang diperlukan.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {isOverpay && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p>
                Pembayaran melebihi total tagihan sebesar{' '}
                <strong>{formatCurrency(previewData.overpaid)}</strong>. Konfirmasi akan diminta
                sebelum data disimpan.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pratinjau perhitungan */}
      {bulan && amount > 0 && (
        <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Info size={15} className="text-primary-600" />
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
              Perhitungan otomatis
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total Dibayar SPP', value: formatCurrency(projectedTotal) },
              { label: 'Sisa Tagihan', value: formatCurrency(projectedRemaining) },
              { label: 'Total Tagihan', value: formatCurrency(annualFee) },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-primary-600/80">
                  {item.label}
                </p>
                <p className="mt-0.5 text-sm font-bold text-primary-900">{item.value}</p>
              </div>
            ))}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-primary-600/80">
                Status
              </p>
              <div className="mt-1">
                <PaymentStatusBadge status={projectedStatus} compact />
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Batalkan
          </button>
        )}
        <button type="submit" disabled={submitting} className={cn('btn-primary')}>
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {submitting ? 'Menyimpan…' : submitLabel}
        </button>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <Wallet size={13} />
        Tekan Enter untuk menyimpan, Esc untuk membatalkan.
      </p>
    </form>
  );
}
