import { useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, CalendarRange, Filter, Loader2, Sparkles, Wallet } from 'lucide-react';
import Select from '../Select';
import { useFilterOptions } from '../../hooks/useStudents';
import { bulkAdjust, previewBulkAdjust, DEFAULT_BULK_NOTE } from '../../services/adjustmentService';
import { listBillingPeriodOptions } from '../../services/paymentService';
import { monthsOfPeriod, PERIOD_MONTHS, periodFromStart } from '../../utils/paymentCalculator';
import { confirmDialog, toast } from '../../lib/toast';
import { formatCurrency, formatNumber } from '../../utils/currency';
import { cn } from '../../utils/helpers';

/**
 * Bulk Adjustment: tandai satu periode tahun ajaran + bulan terpilih sebagai
 * **sudah dibayar di pembukuan sebelumnya** untuk seluruh siswa pada tahun
 * ajaran (angkatan) dan/atau kelas tertentu. Tagihan periode tersebut langsung
 * berkurang dengan nominal yang dihitung otomatis dari tarif SPP angkatan.
 */
export default function AdminBulkAdjust() {
  const { kelas: kelasOptions, tahunAjaran: tahunAjaranOptions } = useFilterOptions();

  const [tahunAjaran, setTahunAjaran] = useState('');
  const [kelas, setKelas] = useState('');
  const [periods, setPeriods] = useState(() => listBillingPeriodOptions());
  const [periodStart, setPeriodStart] = useState(() => {
    const list = listBillingPeriodOptions();
    return list[list.length - 1]?.start ?? null;
  });
  const [months, setMonths] = useState(() => new Set(PERIOD_MONTHS));
  const [keterangan, setKeterangan] = useState(DEFAULT_BULK_NOTE);
  const [working, setWorking] = useState(false);

  const period = periodFromStart(periodStart);
  const periodMonths = useMemo(() => monthsOfPeriod(periodStart), [periodStart]);
  const selectedMonths = useMemo(
    () => PERIOD_MONTHS.filter((month) => months.has(month)),
    [months],
  );

  const criteria = {
    tahunAjaran,
    kelas,
    periodStart,
    months: selectedMonths,
  };
  const preview = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => previewBulkAdjust(criteria),
    [tahunAjaran, kelas, periodStart, selectedMonths.join(',')],
  );

  const handleTahunAjaran = (value) => {
    setTahunAjaran(value);
    const list = listBillingPeriodOptions(value);
    setPeriods(list);
    setPeriodStart(list[list.length - 1]?.start ?? null);
  };

  const toggleMonth = (month) => {
    setMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  const toggleAll = () => {
    setMonths((prev) =>
      prev.size === PERIOD_MONTHS.length ? new Set() : new Set(PERIOD_MONTHS),
    );
  };

  const hasCriteria = Boolean(tahunAjaran || kelas);
  const canApply = hasCriteria && selectedMonths.length > 0 && preview.students > 0 && !working;

  const handleApply = async () => {
    const kriteria = [
      tahunAjaran
        ? `Tahun Ajaran ${tahunAjaranOptions.find((item) => item.value === tahunAjaran)?.label ?? tahunAjaran}`
        : null,
      kelas ? `Kelas ${kelas}` : null,
      period ? `Periode ${period.display}` : null,
      `${selectedMonths.length} bulan`,
    ]
      .filter(Boolean)
      .join(' + ');

    const confirmed = await confirmDialog({
      title: 'Terapkan bulk adjustment?',
      text: `${kriteria}\n\n• ${formatNumber(preview.students)} siswa\n• Total tagihan berkurang ${formatCurrency(preview.total)}\n\nBulan yang dipilih akan dianggap lunas pada peta bulanan siswa tersebut.`,
      confirmText: 'Ya, terapkan',
    });
    if (!confirmed) return;

    setWorking(true);
    const result = bulkAdjust({ ...criteria, keterangan, createdBy: 'Administrator' });
    setWorking(false);

    if (!result.ok) {
      toast.error(result.error || 'Gagal menerapkan bulk adjustment.');
      return;
    }
    toast.success(
      `${formatNumber(result.students)} siswa diperbarui — tagihan berkurang ${formatCurrency(result.total)}.`,
      'Bulk adjustment selesai',
    );
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
      <div className="dark-card p-5 xl:col-span-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Filter size={16} className="text-primary-300" />
          Kriteria Bulk Adjustment
        </h3>
        <p className="mt-0.5 text-xs text-slate-400">
          Pilih tahun ajaran (angkatan) dan/atau kelas, lalu periode serta bulan yang memang sudah
          dibayar di pembukuan sebelumnya.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="adj-tahun" className="dark-label">
              Tahun Ajaran
            </label>
            <Select
              dark
              id="adj-tahun"
              value={tahunAjaran}
              onChange={(event) => handleTahunAjaran(event.target.value)}
              className="dark-input"
            >
              <option value="">Semua Tahun Ajaran</option>
              {tahunAjaranOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="adj-kelas" className="dark-label">
              Kelas
            </label>
            <Select
              dark
              id="adj-kelas"
              value={kelas}
              onChange={(event) => setKelas(event.target.value)}
              className="dark-input"
            >
              <option value="">Semua Kelas</option>
              {kelasOptions.map((item) => (
                <option key={item} value={item}>
                  Kelas {item}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="adj-periode" className="dark-label">
              Periode
            </label>
            <Select
              dark
              id="adj-periode"
              value={periodStart ?? ''}
              onChange={(event) => setPeriodStart(Number(event.target.value))}
              className="dark-input"
            >
              {periods.map((item) => (
                <option key={item.start} value={item.start}>
                  {item.display}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Bulan yang Sudah Dibayar ({selectedMonths.length}/{PERIOD_MONTHS.length})
            </p>
            <button type="button" onClick={toggleAll} className="dark-btn-ghost dark-btn-sm">
              {selectedMonths.length === PERIOD_MONTHS.length ? 'Kosongkan' : 'Pilih semua'}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {periodMonths.map((item) => {
              const active = months.has(item.bulan);
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => toggleMonth(item.bulan)}
                  aria-pressed={active}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition',
                    active
                      ? 'border-primary-400/50 bg-primary-500/15 text-primary-100'
                      : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.06]',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] font-bold',
                      active
                        ? 'border-primary-400 bg-primary-500 text-white'
                        : 'border-white/20 bg-transparent text-transparent',
                    )}
                  >
                    ✓
                  </span>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="adj-keterangan" className="dark-label">
            Keterangan
          </label>
          <textarea
            id="adj-keterangan"
            rows={2}
            value={keterangan}
            onChange={(event) => setKeterangan(event.target.value)}
            className="dark-input resize-none"
            placeholder={DEFAULT_BULK_NOTE}
          />
        </div>
      </div>

      {/* Ringkasan dampak */}
      <div className="space-y-5 xl:col-span-2">
        <div className="dark-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles size={16} className="text-primary-300" />
            Perkiraan Dampak
          </h3>

          {!hasCriteria ? (
            <p className="mt-3 text-xs text-slate-400">
              Pilih tahun ajaran atau kelas terlebih dahulu untuk melihat perkiraan.
            </p>
          ) : (
            <>
              <div className="mt-4 space-y-2.5">
                {[
                  { label: 'Siswa terdampak', value: formatNumber(preview.students) },
                  { label: 'Tagihan berkurang', value: formatCurrency(preview.total) },
                  { label: 'Adjustment baru', value: formatNumber(preview.willCreate) },
                  { label: 'Adjustment diperbarui', value: formatNumber(preview.willUpdate) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                      {row.label}
                    </span>
                    <span className="text-sm font-bold text-white">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <CalendarRange size={13} />
                  Periode & Bulan
                </p>
                <p className="mt-1.5 text-xs text-slate-200">
                  {period ? period.display : 'Pilih periode'}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {selectedMonths.length > 0 ? selectedMonths.join(', ') : 'Belum ada bulan dipilih'}
                </p>
              </div>

              {preview.sample.length > 0 && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Contoh siswa terdampak
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-xs text-slate-300">
                    {preview.sample.map((nama) => (
                      <li key={nama} className="truncate">
                        • {nama}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="dark-card p-5">
          <div className="flex items-start gap-3">
            <Wallet size={18} className="mt-0.5 shrink-0 text-slate-400" />
            <p className="text-xs leading-relaxed text-slate-400">
              Nominal adjustment dihitung otomatis: <strong className="text-slate-200">jumlah
              bulan × tarif SPP angkatan siswa</strong>. Bulan yang dipilih otomatis hijau pada peta
              bulanan siswa, dan adjustment yang sudah ada pada periode yang sama akan digabung
              (tidak menumpuk nominalnya).
            </p>
          </div>

          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className="dark-btn-primary mt-4 w-full"
          >
            {working ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
            {working ? 'Memproses…' : 'Terapkan Bulk Adjust'}
          </button>

          {!hasCriteria && (
            <p className="mt-2 flex items-center gap-1.5 text-center text-[11px] text-amber-300/80">
              <AlertTriangle size={12} />
              Pilih tahun ajaran atau kelas terlebih dahulu.
            </p>
          )}
          {hasCriteria && selectedMonths.length === 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-center text-[11px] text-amber-300/80">
              <AlertTriangle size={12} />
              Centang minimal satu bulan yang sudah dibayar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
