import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  Coins,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import {
  DEFAULT_EKSKUL,
  DEFAULT_EKSKUL_FEE,
  DEFAULT_SPP_RATES,
  DEFAULT_SPP_RATE,
  getSettings,
  resetSettings,
  saveSettings,
  yearLabelFromPrefix,
} from '../services/settingsService';
import { confirmDialog, toast } from '../lib/toast';
import { formatCurrency, parseCurrencyInput } from '../utils/currency';
import { cn } from '../utils/helpers';

function Section({ icon: Icon, title, description, children, actions }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="card overflow-hidden"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3.5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-white text-primary-600 ring-1 ring-slate-200">
          <Icon size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </motion.section>
  );
}

export default function Pengaturan() {
  const { version } = useData();
  const { can, isAdministrator } = useAuth();

  const settings = useMemo(() => getSettings(), [version]);

  const [sppRows, setSppRows] = useState(() =>
    Object.entries(settings.spp_rates)
      .map(([prefix, amount]) => ({ prefix: String(prefix), amount: String(amount) }))
      .sort((a, b) => a.prefix.localeCompare(b.prefix)),
  );
  const [defaultRate, setDefaultRate] = useState(String(settings.default_spp_rate));
  const [ekskulRows, setEkskulRows] = useState(() =>
    settings.ekskul.map((item) => ({ nama: item.nama, biaya: String(item.biaya) })),
  );
  const [newPrefix, setNewPrefix] = useState('');
  const [newEkskul, setNewEkskul] = useState({ nama: '', biaya: String(DEFAULT_EKSKUL_FEE) });
  const [saving, setSaving] = useState(false);

  if (!can('settings.manage')) {
    return (
      <div className="card card-pad text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
          <ShieldCheck size={26} />
        </div>
        <h1 className="mt-4 text-lg font-bold text-slate-900">Akses Terbatas</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">
          Pengaturan tarif hanya dapat diubah oleh pengguna dengan hak akses
          <span className="font-medium text-slate-700"> Ubah pengaturan tarif</span>.
        </p>
        <Link to="/" className="btn-primary mt-5 inline-flex">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  /* ----------------------- baris SPP ----------------------- */
  const updateSppRow = (index, patch) =>
    setSppRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const removeSppRow = (index) => setSppRows((rows) => rows.filter((_, i) => i !== index));

  const addSppRow = () => {
    const prefix = newPrefix.trim();
    if (!/^\d{2}$/.test(prefix)) {
      toast.error('Prefix tahun angkatan harus 2 digit angka, mis. 27.');
      return;
    }
    if (sppRows.some((row) => row.prefix === prefix)) {
      toast.error(`Angkatan ${prefix} sudah ada pada daftar.`);
      return;
    }
    setSppRows((rows) => [...rows, { prefix, amount: String(defaultRate) }]);
    setNewPrefix('');
  };

  /* ----------------------- baris ekskul ----------------------- */
  const updateEkskulRow = (index, patch) =>
    setEkskulRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const removeEkskulRow = (index) => setEkskulRows((rows) => rows.filter((_, i) => i !== index));

  const addEkskulRow = () => {
    const nama = newEkskul.nama.trim();
    if (!nama) {
      toast.error('Nama ekskul wajib diisi.');
      return;
    }
    if (ekskulRows.some((row) => row.nama.toLowerCase() === nama.toLowerCase())) {
      toast.error(`Ekskul ${nama} sudah ada pada daftar.`);
      return;
    }
    setEkskulRows((rows) => [...rows, { nama, biaya: newEkskul.biaya }]);
    setNewEkskul({ nama: '', biaya: String(DEFAULT_EKSKUL_FEE) });
  };

  /* ----------------------- simpan ----------------------- */
  const handleSave = () => {
    // Validasi tarif SPP
    const sppRates = {};
    for (const row of sppRows) {
      if (!/^\d{2}$/.test(row.prefix)) {
        toast.error(`Prefix "${row.prefix}" tidak valid (harus 2 digit angka).`);
        return;
      }
      const amount = parseCurrencyInput(row.amount);
      if (amount <= 0) {
        toast.error(`Tarif angkatan ${row.prefix} harus lebih dari 0.`);
        return;
      }
      sppRates[row.prefix] = amount;
    }

    const defaultSpp = parseCurrencyInput(defaultRate);
    if (defaultSpp <= 0) {
      toast.error('Tarif berjalan (prefix tak dikenal) harus lebih dari 0.');
      return;
    }

    if (ekskulRows.length === 0) {
      toast.error('Minimal satu ekskul harus tersedia.');
      return;
    }

    const ekskul = [];
    for (const row of ekskulRows) {
      const nama = row.nama.trim();
      if (!nama) {
        toast.error('Ada nama ekskul yang masih kosong.');
        return;
      }
      if (ekskul.some((item) => item.nama.toLowerCase() === nama.toLowerCase())) {
        toast.error(`Ekskul ${nama} tercatat lebih dari sekali.`);
        return;
      }
      ekskul.push({ nama, biaya: parseCurrencyInput(row.biaya) });
    }

    setSaving(true);
    saveSettings({ spp_rates: sppRates, default_spp_rate: defaultSpp, ekskul });
    setSaving(false);
    toast.success('Pengaturan tarif berhasil disimpan.');
  };

  const handleReset = async () => {
    const confirmed = await confirmDialog({
      title: 'Kembalikan pengaturan ke bawaan?',
      text: `Tarif SPP kembali ke ${formatCurrency(
        DEFAULT_SPP_RATES['26'],
      )}/bulan (per angkatan) dan daftar ekskul kembali ke ${DEFAULT_EKSKUL.length} ekskul bawaan.`,
      confirmText: 'Ya, kembalikan',
    });
    if (!confirmed) return;

    resetSettings();
    setSppRows(
      Object.entries(DEFAULT_SPP_RATES).map(([prefix, amount]) => ({
        prefix,
        amount: String(amount),
      })),
    );
    setDefaultRate(String(DEFAULT_SPP_RATE));
    setEkskulRows(DEFAULT_EKSKUL.map((item) => ({ nama: item.nama, biaya: String(item.biaya) })));
    toast.success('Pengaturan dikembalikan ke bawaan.');
  };

  return (
    <div>
      <PageHeader
        title="Pengaturan Tarif"
        subtitle="Atur tarif SPP per angkatan dan biaya tiap ekskul. Perubahan langsung dipakai untuk perhitungan berikutnya."
        badge={<span className="stat-chip">{formatCurrency(defaultRate)} berjalan</span>}
        actions={
          <>
            <button type="button" onClick={handleReset} className="btn-secondary btn-sm">
              <RotateCcw size={15} />
              Kembalikan Bawaan
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary btn-sm">
              <Save size={15} />
              {saving ? 'Menyimpan…' : 'Simpan Pengaturan'}
            </button>
          </>
        }
      />

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-semibold text-amber-900">Perhatikan sebelum mengubah tarif</p>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-800/90">
            <li>
              • Tarif SPP ditentukan dari <strong>2 digit awal No Induk</strong>, mis. prefix 21 =
              angkatan 2021/2022.
            </li>
            <li>
              • Perubahan tarif hanya memengaruhi perhitungan <strong>berikutnya</strong>; transaksi
              pembayaran yang sudah tercatat tidak berubah.
            </li>
            <li>
              • Total tagihan tahunan = tarif bulanan × 12. Ekskul dibayar per bulan tanpa total
              tahunan.
            </li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Tarif SPP */}
        <Section
          icon={Coins}
          title="Tarif SPP Bulanan per Angkatan"
          description="Prefix 2 digit awal No Induk (tahun angkatan siswa)"
        >
          <div className="space-y-2.5">
            {sppRows.map((row, index) => (
              <div
                key={row.prefix}
                className="grid grid-cols-12 items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3"
              >
                <div className="col-span-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Prefix
                  </p>
                  <p className="mt-1 font-mono text-sm font-bold text-slate-800">{row.prefix}</p>
                </div>
                <div className="col-span-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Tahun Ajaran
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {yearLabelFromPrefix(row.prefix) ?? '-'}
                  </p>
                </div>
                <div className="col-span-3">
                  <label
                    htmlFor={`spp-${row.prefix}`}
                    className="text-[11px] font-medium uppercase tracking-wide text-slate-400"
                  >
                    Per Bulan
                  </label>
                  <input
                    id={`spp-${row.prefix}`}
                    type="text"
                    inputMode="numeric"
                    value={formatCurrency(parseCurrencyInput(row.amount), { withSymbol: false })}
                    onChange={(e) =>
                      updateSppRow(index, { amount: String(parseCurrencyInput(e.target.value)) })
                    }
                    className="input mt-1 py-2 text-sm font-semibold"
                  />
                </div>
                <div className="col-span-1 flex justify-end pb-1">
                  <button
                    type="button"
                    onClick={() => removeSppRow(index)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    title="Hapus angkatan"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
            <div className="w-24">
              <label htmlFor="new-prefix" className="label">
                Prefix Baru
              </label>
              <input
                id="new-prefix"
                type="text"
                maxLength={2}
                value={newPrefix}
                onChange={(e) => setNewPrefix(e.target.value.replace(/\D/g, ''))}
                placeholder="27"
                className="input font-mono"
              />
            </div>
            <button type="button" onClick={addSppRow} className="btn-secondary">
              <Plus size={15} />
              Tambah Angkatan
            </button>
          </div>

          <div className="mt-5 rounded-xl border border-primary-100 bg-primary-50/60 p-4">
            <label htmlFor="default-rate" className="text-xs font-semibold text-primary-900">
              Tarif berjalan (untuk prefix yang belum diatur)
            </label>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-500">Rp</span>
              <input
                id="default-rate"
                type="text"
                inputMode="numeric"
                value={formatCurrency(parseCurrencyInput(defaultRate), { withSymbol: false })}
                onChange={(e) => setDefaultRate(String(parseCurrencyInput(e.target.value)))}
                className="input max-w-[200px] font-semibold"
              />
              <span className="text-xs text-primary-800/70">/bulan</span>
            </div>
          </div>
        </Section>

        {/* Biaya ekskul */}
        <Section
          icon={Award}
          title="Biaya Ekskul"
          description="Daftar ekskul yang muncul pada dropdown pendaftaran ekskul"
        >
          <div className="space-y-2.5">
            {ekskulRows.map((row, index) => (
              <div
                key={`${row.nama}-${index}`}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3"
              >
                <input
                  type="text"
                  value={row.nama}
                  onChange={(e) => updateEkskulRow(index, { nama: e.target.value })}
                  className="input flex-1 py-2 text-sm font-medium"
                  placeholder="Nama ekskul"
                  aria-label={`Nama ekskul baris ${index + 1}`}
                />
                <div className="relative w-32">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatCurrency(parseCurrencyInput(row.biaya), { withSymbol: false })}
                    onChange={(e) =>
                      updateEkskulRow(index, { biaya: String(parseCurrencyInput(e.target.value)) })
                    }
                    className="input py-2 pl-8 text-sm font-semibold"
                    aria-label={`Biaya ${row.nama}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeEkskulRow(index)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  title="Hapus ekskul"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
            <div className="min-w-[160px] flex-1">
              <label htmlFor="new-ekskul" className="label">
                Ekskul Baru
              </label>
              <input
                id="new-ekskul"
                type="text"
                value={newEkskul.nama}
                onChange={(e) => setNewEkskul((v) => ({ ...v, nama: e.target.value }))}
                placeholder="Mis. Panahan"
                className="input"
              />
            </div>
            <div className="w-32">
              <label htmlFor="new-ekskul-fee" className="label">
                Biaya / Bulan
              </label>
              <input
                id="new-ekskul-fee"
                type="text"
                inputMode="numeric"
                value={formatCurrency(parseCurrencyInput(newEkskul.biaya), { withSymbol: false })}
                onChange={(e) =>
                  setNewEkskul((v) => ({ ...v, biaya: String(parseCurrencyInput(e.target.value)) }))
                }
                className="input font-semibold"
              />
            </div>
            <button type="button" onClick={addEkskulRow} className="btn-secondary">
              <Plus size={15} />
              Tambah Ekskul
            </button>
          </div>
        </Section>
      </div>

      <div
        className={cn(
          'mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5',
          isAdministrator
            ? 'border-school-200 bg-school-50/70'
            : 'border-slate-200 bg-slate-50',
        )}
      >
        <p className="flex items-center gap-2 text-xs text-slate-600">
          <BadgeCheck size={14} className="text-school-600" />
          Pengaturan ini tersimpan otomatis ke database dan dipakai seluruh pengguna.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={handleReset} className="btn-secondary btn-sm">
            <RotateCcw size={14} />
            Kembalikan Bawaan
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary btn-sm">
            <Save size={14} />
            Simpan Pengaturan
          </button>
        </div>
      </div>
    </div>
  );
}
