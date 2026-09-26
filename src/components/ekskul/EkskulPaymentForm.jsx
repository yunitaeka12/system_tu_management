import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Info, Loader2, Save, Wallet } from 'lucide-react';
import FormField from '../FormField';
import { MONTHS } from '../../utils/paymentCalculator';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '../../utils/currency';
import { cn } from '../../utils/helpers';
import { getEkskulFee } from '../../services/ekskulService';

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Form pembayaran ekskul.
 *
 * Berbeda dengan SPP: tidak ada total tagihan tahunan (tidak × 12 bulan),
 * targetnya hanya biaya bulanan ekskul yang dipilih.
 */
export default function EkskulPaymentForm({
  student,
  enrollment,
  initialValues = null,
  excludePaymentId = null,
  preview,
  submitting = false,
  onSubmit,
  onCancel,
  submitLabel = 'Simpan Pembayaran Ekskul',
}) {
  const [bulan, setBulan] = useState(initialValues?.bulan ?? '');
  const monthlyFee = Number(enrollment?.biaya_bulanan) || getEkskulFee(enrollment?.ekskul_nama);
  const [nominal, setNominal] = useState(
    initialValues ? String(initialValues.nominal_bayar) : String(monthlyFee),
  );
  const [tanggalBayar, setTanggalBayar] = useState(initialValues?.tanggal_bayar ?? todayISO());
  const [keterangan, setKeterangan] = useState(initialValues?.keterangan ?? '');
  const [error, setError] = useState('');

  const amount = parseCurrencyInput(nominal);

  const previewData = useMemo(
    () => (preview ? preview({ bulan, nominal: amount }) : null),
    [preview, bulan, amount],
  );

  const [keteranganTouched, setKeteranganTouched] = useState(Boolean(initialValues?.keterangan));

  useEffect(() => {
    if (keteranganTouched || !bulan) return;
    const total = previewData?.projectedMonthTotal ?? amount;
    if (total >= monthlyFee) setKeterangan('LUNAS');
    else if (total > 0) setKeterangan(`Belum Lunas - Sisa ${formatCurrency(monthlyFee - total)}`);
    else setKeterangan('Terbayar');
  }, [previewData, monthlyFee, amount, bulan, keteranganTouched]);

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
      tanggalBayar,
      keterangan,
      excludePaymentId,
    });
  };

  const duplicate = previewData?.duplicate;
  const isOverpay = previewData?.isOverpay;

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Data Pembayaran Ekskul
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {[
            { label: 'Nama Siswa', value: student?.nama_lengkap },
            { label: 'No Induk', value: student?.no_induk },
            { label: 'Kelas', value: student?.kelas },
            { label: 'Ekskul', value: enrollment?.ekskul_nama },
          ].map((item) => (
            <div key={item.label} className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {item.label}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Biaya Bulanan Ekskul
          </p>
          <p className="mt-0.5 text-sm font-bold text-slate-800">{formatCurrency(monthlyFee)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Bulan Bayar" htmlFor="eks-bulan" required>
          <div className="relative">
            <CalendarDays
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              id="eks-bulan"
              value={bulan}
              onChange={(e) => setBulan(e.target.value)}
              className="input pl-10"
            >
              <option value="">Pilih Bulan</option>
              {MONTHS.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>
        </FormField>

        <FormField label="Nominal Bayar" htmlFor="eks-nominal" required hint={formatCurrency(amount)}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
              Rp
            </span>
            <input
              id="eks-nominal"
              type="text"
              inputMode="numeric"
              value={formatCurrencyInput(nominal)}
              onChange={(e) => setNominal(String(parseCurrencyInput(e.target.value)))}
              placeholder={formatCurrency(monthlyFee, { withSymbol: false })}
              className="input pl-10 font-semibold"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setNominal(String(monthlyFee))}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-primary-300 hover:text-primary-600"
            >
              {formatCurrency(monthlyFee)}
            </button>
            {previewData && previewData.monthTotal > 0 && previewData.monthTotal < monthlyFee && (
              <button
                type="button"
                onClick={() => setNominal(String(monthlyFee - previewData.monthTotal))}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-primary-300 hover:text-primary-600"
              >
                Lunasi bulan ini ({formatCurrency(monthlyFee - previewData.monthTotal)})
              </button>
            )}
          </div>
        </FormField>

        <FormField label="Tanggal Bayar" htmlFor="eks-tanggal">
          <input
            id="eks-tanggal"
            type="date"
            value={tanggalBayar}
            onChange={(e) => setTanggalBayar(e.target.value)}
            className="input"
          />
        </FormField>

        <FormField label="Keterangan" htmlFor="eks-keterangan" hint="Otomatis, bisa diubah">
          <input
            id="eks-keterangan"
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

      {duplicate?.hasDuplicate && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Pembayaran bulan {bulan} sudah tercatat.</p>
            <p className="mt-0.5 text-xs text-amber-700">
              {duplicate.count} transaksi dengan total {formatCurrency(duplicate.total)}. Anda tetap
              dapat menambah pembayaran susulan.
            </p>
          </div>
        </div>
      )}

      {isOverpay && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>
            Nominal melebihi biaya bulanan sebesar{' '}
            <strong>{formatCurrency(previewData.overpaid)}</strong>. Konfirmasi akan diminta sebelum
            disimpan.
          </p>
        </div>
      )}

      {bulan && amount > 0 && (
        <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Info size={15} className="text-primary-600" />
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
              Perhitungan bulan {bulan}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: 'Sudah Tercatat (bulan ini)', value: previewData?.monthTotal ?? 0 },
              { label: 'Total Setelah Simpan', value: previewData?.projectedMonthTotal ?? amount },
              { label: 'Biaya Bulanan', value: monthlyFee },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-primary-600/80">
                  {item.label}
                </p>
                <p className="mt-0.5 text-sm font-bold text-primary-900">
                  {formatCurrency(item.value)}
                </p>
              </div>
            ))}
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
        Ekskul dibayar per bulan sesuai biaya ekskul yang dipilih.
      </p>
    </form>
  );
}

