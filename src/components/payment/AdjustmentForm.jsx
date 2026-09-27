import { useMemo, useState } from 'react';
import { CalendarCheck, Info, Loader2, Save } from 'lucide-react';
import FormField from '../FormField';
import Select from '../Select';
import {
  PERIOD_MONTHS,
  currentPeriodStart,
  getMonthlyFee,
  monthsOfPeriod,
  periodFromStart,
} from '../../utils/paymentCalculator';
import { monthsOf } from '../../services/adjustmentService';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '../../utils/currency';
import { cn } from '../../utils/helpers';

/** Keterangan yang paling sering dipakai, diisi otomatis tapi tetap bisa diubah. */
export const DEFAULT_ADJUSTMENT_NOTE = 'Sudah bayar dan tercatat di pembukuan sebelumnya';

/**
 * Form Adjustment tagihan SPP.
 *
 * Dipakai untuk mencatat pembayaran yang sudah tercatat di pembukuan
 * sebelumnya (di luar aplikasi): nominalnya mengurangi tagihan siswa, dan
 * bulan yang dicentang otomatis berstatus lunas pada Peta Pembayaran Bulanan.
 */
export default function AdjustmentForm({
  student,
  initialValues = null,
  monthlyFee,
  periodOptions = [],
  defaultPeriodStart = currentPeriodStart(),
  submitting = false,
  onSubmit,
  onCancel,
  submitLabel = 'Simpan Adjustment',
}) {
  const fee = Number(monthlyFee) || getMonthlyFee(student?.no_induk);

  const [nominal, setNominal] = useState(
    initialValues ? String(initialValues.nominal) : '',
  );
  const [keterangan, setKeterangan] = useState(
    initialValues?.keterangan ?? DEFAULT_ADJUSTMENT_NOTE,
  );
  // `initialValues.bulan` bisa datang sebagai array (jsonb) — dinormalisasi dulu.
  const [bulan, setBulan] = useState(() => new Set(monthsOf(initialValues)));
  // `tahun` sekarang menyimpan tahun mulai periode tahun ajaran (Juli–Juni).
  const [tahun, setTahun] = useState(
    Number(initialValues?.tahun) || Number(defaultPeriodStart) || currentPeriodStart(),
  );
  const [error, setError] = useState('');

  const amount = parseCurrencyInput(nominal);
  const checked = useMemo(() => PERIOD_MONTHS.filter((month) => bulan.has(month)), [bulan]);
  const monthsTotal = checked.length * fee;
  const diff = amount - monthsTotal;

  // Bulan mengikuti periode terpilih, jadi labelnya ikut menyebut tahunnya.
  const months = useMemo(() => monthsOfPeriod(tahun), [tahun]);

  const periods = useMemo(() => {
    const list = new Map();
    [...(periodOptions || []), periodFromStart(tahun), periodFromStart(currentPeriodStart())]
      .filter(Boolean)
      .forEach((period) => list.set(period.start, period));
    return [...list.values()].sort((a, b) => b.start - a.start);
  }, [periodOptions, tahun]);

  const toggleMonth = (month) => {
    setBulan((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  const toggleAll = () => {
    setBulan((prev) =>
      prev.size === PERIOD_MONTHS.length ? new Set() : new Set(PERIOD_MONTHS),
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (amount <= 0) {
      setError('Total adjustment harus lebih dari 0.');
      return;
    }
    if (checked.length === 0) {
      setError('Centang minimal satu bulan yang sudah dibayar.');
      return;
    }
    setError('');
    onSubmit({
      nominal: amount,
      bulan: checked,
      tahun: Number(tahun),
      keterangan,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="rounded-lg border border-primary-100 bg-primary-50/60 p-3.5">
        <div className="flex gap-2.5">
          <Info size={16} className="mt-0.5 shrink-0 text-primary-600" />
          <p className="text-xs leading-relaxed text-primary-800">
            Adjustment dipakai untuk <strong>pembayaran yang sudah tercatat di pembukuan
            sebelumnya</strong> (di luar aplikasi). Tagihan {student?.nama_lengkap ?? 'siswa'} berkurang
            sesuai nominal, dan bulan yang dicentang <strong>langsung lunas (hijau)</strong> pada Peta
            Pembayaran Bulanan tanpa perlu transaksi baru.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Total Adjustment"
          htmlFor="adj_nominal"
          hint={amount > 0 ? formatCurrency(amount) : 'Nominal yang sudah dibayar sebelumnya'}
          required
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
              Rp
            </span>
            <input
              id="adj_nominal"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={formatCurrencyInput(nominal)}
              onChange={(event) => setNominal(String(parseCurrencyInput(event.target.value)))}
              placeholder={formatCurrency(monthsTotal || 0, { withSymbol: false })}
              className="input pl-10 font-semibold"
            />
          </div>
        </FormField>

        <FormField
          label="Periode Tahun Ajaran"
          htmlFor="adj_tahun"
          hint="Menentukan periode peta bulanan mana yang berubah"
        >
          <Select
            id="adj_tahun"
            value={tahun}
            onChange={(event) => setTahun(Number(event.target.value))}
            className="input"
          >
            {periods.map((period) => (
              <option key={period.start} value={period.start}>
                {period.display}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Keterangan" htmlFor="adj_keterangan">
        <textarea
          id="adj_keterangan"
          rows={2}
          value={keterangan}
          onChange={(event) => setKeterangan(event.target.value)}
          placeholder={DEFAULT_ADJUSTMENT_NOTE}
          className="input resize-none"
        />
      </FormField>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="label mb-0">
            Bulan yang Dicentang
            <span className="ml-1 font-normal text-slate-400">
              ({checked.length}/{PERIOD_MONTHS.length})
            </span>
          </label>
          <button type="button" onClick={toggleAll} className="btn-ghost btn-sm">
            {checked.length === PERIOD_MONTHS.length ? 'Kosongkan' : 'Pilih semua'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {months.map((item) => {
            const active = bulan.has(item.bulan);
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => toggleMonth(item.bulan)}
                aria-pressed={active}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition',
                  active
                    ? 'border-school-300 bg-school-50 text-school-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <span
                  className={cn(
                    'grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] text-white',
                    active ? 'border-school-500 bg-school-500' : 'border-slate-300 bg-white',
                  )}
                >
                  {active ? '✓' : ''}
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-slate-600">
            {checked.length} bulan × {formatCurrency(fee)} =
            <strong className="ml-1 text-slate-800">{formatCurrency(monthsTotal)}</strong>
          </span>
          <span className="text-slate-600">
            Total adjustment:
            <strong className="ml-1 text-slate-800">{formatCurrency(amount)}</strong>
          </span>
        </div>

        {amount > 0 && checked.length > 0 && diff !== 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-amber-700">
            <span className="mt-px">•</span>
            <span>
              {diff > 0
                ? `Nominal ${formatCurrency(diff)} lebih besar dari total bulan yang dicentang — kelebihannya tetap mengurangi sisa tagihan.`
                : `Nominal kurang ${formatCurrency(Math.abs(diff))} dari total bulan yang dicentang. Bulan yang dicentang tetap dianggap lunas.`}
            </span>
          </p>
        )}

        {amount > 0 && checked.length > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-school-700">
            <CalendarCheck size={14} />
            Sisa tagihan berkurang {formatCurrency(amount)}, {checked.length} bulan menjadi hijau di
            peta bulanan.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="btn-secondary"
        >
          Batalkan
        </button>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
