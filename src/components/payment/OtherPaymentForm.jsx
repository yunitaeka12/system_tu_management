import { useState } from 'react';
import { AlertTriangle, CalendarDays, Info, Loader2, Save } from 'lucide-react';
import FormField from '../FormField';
import Select from '../Select';
import {
  currentPeriodStart,
  monthsOfPeriod,
  periodFromStart,
  periodStartOf,
} from '../../utils/paymentCalculator';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '../../utils/currency';
import { cn } from '../../utils/helpers';

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Form pembayaran lain-lain (di luar SPP) — mis. seragam, uang kegiatan.
 *
 * Pembayaran ini **tidak mengurangi tagihan SPP**; hanya tercatat di peta
 * bulanan dan riwayat transaksi siswa.
 */
export default function OtherPaymentForm({
  student,
  initialValues = null,
  periodStart,
  submitting = false,
  onSubmit,
  onCancel,
  submitLabel = 'Simpan Pembayaran Lain',
}) {
  const start =
    Number(periodStart) ||
    (initialValues ? periodStartOf(initialValues.bulan, initialValues.tahun) : null) ||
    currentPeriodStart();
  const period = periodFromStart(start);
  const months = monthsOfPeriod(start);

  const [bulan, setBulan] = useState(initialValues?.bulan ?? months[0]?.bulan ?? '');
  const [nominal, setNominal] = useState(
    initialValues ? String(initialValues.nominal_bayar) : '',
  );
  const [tanggalBayar, setTanggalBayar] = useState(initialValues?.tanggal_bayar ?? todayISO());
  const [keterangan, setKeterangan] = useState(initialValues?.keterangan ?? '');
  const [error, setError] = useState('');

  const amount = parseCurrencyInput(nominal);

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
    if (!keterangan.trim()) {
      setError('Keterangan pembayaran wajib diisi (mis. Seragam olahraga).');
      return;
    }
    setError('');
    onSubmit({
      bulan,
      nominal: amount,
      jenis: 'lain',
      tahun: months.find((item) => item.bulan === bulan)?.tahun,
      tanggalBayar,
      keterangan,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="rounded-lg border border-primary-100 bg-primary-50/60 p-3.5">
        <div className="flex gap-2.5">
          <Info size={16} className="mt-0.5 shrink-0 text-primary-600" />
          <p className="text-xs leading-relaxed text-primary-800">
            Pembayaran lain-lain untuk {student?.nama_lengkap ?? 'siswa'} (mis. seragam, uang
            kegiatan) <strong>tidak mengurangi tagihan SPP</strong>, tetapi ikut tampil di peta
            bulanan dan riwayat transaksi.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Bulan Bayar" htmlFor="lain-bulan" required>
          <div className="relative">
            <CalendarDays
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Select
              id="lain-bulan"
              value={bulan}
              onChange={(event) => setBulan(event.target.value)}
              className="input pl-10"
            >
              <option value="">Pilih Bulan</option>
              {months.map((item) => (
                <option key={item.label} value={item.bulan}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          {period ? (
            <p className="mt-1 text-[11px] text-slate-400">Periode {period.display}</p>
          ) : null}
        </FormField>

        <FormField
          label="Nominal Bayar"
          htmlFor="lain-nominal"
          required
          hint={amount > 0 ? formatCurrency(amount) : 'Nominal di luar tagihan SPP'}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
              Rp
            </span>
            <input
              id="lain-nominal"
              type="text"
              inputMode="numeric"
              value={formatCurrencyInput(nominal)}
              onChange={(event) => setNominal(String(parseCurrencyInput(event.target.value)))}
              placeholder="0"
              className="input pl-10 font-semibold"
            />
          </div>
        </FormField>

        <FormField label="Tanggal Bayar" htmlFor="lain-tanggal">
          <input
            id="lain-tanggal"
            type="date"
            value={tanggalBayar}
            onChange={(event) => setTanggalBayar(event.target.value)}
            className="input"
          />
        </FormField>

        <FormField label="Keterangan Pembayaran" htmlFor="lain-keterangan" required>
          <input
            id="lain-keterangan"
            type="text"
            value={keterangan}
            onChange={(event) => setKeterangan(event.target.value)}
            placeholder="mis. Seragam olahraga"
            className="input"
          />
        </FormField>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Batalkan
        </button>
        <button type="submit" disabled={submitting} className={cn('btn-primary')}>
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {submitting ? 'Menyimpan…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
