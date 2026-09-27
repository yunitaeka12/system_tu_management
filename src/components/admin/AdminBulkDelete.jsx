import { useMemo, useState } from 'react';
import { AlertTriangle, Database, Filter, Trash2 } from 'lucide-react';
import Select from '../Select';
import { useFilterOptions } from '../../hooks/useStudents';
import { bulkDelete, previewBulkDelete } from '../../services/studentService';
import { confirmDialog, toast } from '../../lib/toast';
import { formatNumber } from '../../utils/currency';
import { cn } from '../../utils/helpers';

const MODES = [
  {
    value: 'students',
    label: 'Hapus siswa beserta seluruh datanya',
    hint: 'Buku Induk, pembayaran SPP, pendaftaran ekskul, dan pembayaran ekskul ikut terhapus.',
  },
  {
    value: 'payments',
    label: 'Hapus transaksi pembayaran saja',
    hint: 'Data siswa tetap aman. Hanya riwayat pembayaran SPP & ekskul yang dihapus.',
  },
];

export default function AdminBulkDelete() {
  const { kelas: kelasOptions, tahunAjaran: tahunAjaranOptions } = useFilterOptions();

  const [kelas, setKelas] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState('');
  const [mode, setMode] = useState('students');
  const [working, setWorking] = useState(false);

  const criteria = { kelas, tahunAjaran };
  const preview = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => previewBulkDelete(criteria),
    [kelas, tahunAjaran],
  );

  const hasCriteria = Boolean(kelas || tahunAjaran);

  const handleBulkDelete = async () => {
    const kriteria = [
      kelas ? `Kelas ${kelas}` : null,
      tahunAjaran
        ? `Tahun Ajaran ${tahunAjaranOptions.find((item) => item.value === tahunAjaran)?.label}`
        : null,
    ]
      .filter(Boolean)
      .join(' + ');

    const confirmed = await confirmDialog({
      title: 'Konfirmasi hapus massal',
      text: `${kriteria}\n\n• ${formatNumber(preview.students)} siswa\n• ${
        mode === 'students' ? `${formatNumber(preview.payments)} pembayaran SPP` : `${formatNumber(preview.payments)} pembayaran SPP`
      }\n• ${formatNumber(preview.ekskul)} pendaftaran ekskul\n\nTindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Ya, hapus sekarang',
    });
    if (!confirmed) return;

    setWorking(true);
    const result = bulkDelete({ ...criteria, mode });
    setWorking(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      mode === 'students'
        ? `${formatNumber(result.students)} siswa dan seluruh datanya berhasil dihapus.`
        : `Riwayat pembayaran ${formatNumber(result.students)} siswa berhasil dihapus.`,
      'Hapus massal selesai',
    );
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
      <div className="dark-card p-5 xl:col-span-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Filter size={16} className="text-primary-300" />
          Kriteria Data yang Dihapus
        </h3>
        <p className="mt-0.5 text-xs text-slate-400">
          Pilih minimal satu kriteria: kelas, tahun ajaran, atau keduanya.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="bulk-kelas" className="dark-label">
              Kelas
            </label>
            <Select
              dark
              id="bulk-kelas"
              value={kelas}
              onChange={(e) => setKelas(e.target.value)}
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
            <label htmlFor="bulk-tahun" className="dark-label">
              Tahun Ajaran
            </label>
            <Select
              dark
              id="bulk-tahun"
              value={tahunAjaran}
              onChange={(e) => setTahunAjaran(e.target.value)}
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
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Jenis Penghapusan
          </p>
          <div className="space-y-2">
            {MODES.map((item) => (
              <label
                key={item.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition',
                  mode === item.value
                    ? 'border-primary-400/40 bg-primary-500/10'
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]',
                )}
              >
                <input
                  type="radio"
                  name="bulk-mode"
                  value={item.value}
                  checked={mode === item.value}
                  onChange={() => setMode(item.value)}
                  className="mt-0.5 h-4 w-4 accent-primary-500"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-100">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{item.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Ringkasan dampak */}
      <div className="space-y-5 xl:col-span-2">
        <div className="dark-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Database size={16} className="text-primary-300" />
            Perkiraan Dampak
          </h3>

          <div className="mt-4 space-y-2.5">
            {[
              { label: 'Data siswa', value: preview.students },
              { label: 'Pembayaran SPP', value: preview.payments },
              { label: 'Pendaftaran ekskul', value: preview.ekskul },
              { label: 'Pembayaran ekskul', value: preview.ekskulPayments },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-wide text-slate-400">{row.label}</span>
                <span className="text-sm font-bold text-white">{formatNumber(row.value)}</span>
              </div>
            ))}
          </div>

          {preview.sample.length > 0 && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Contoh data terdampak
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
        </div>

        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-300" />
            <div>
              <h3 className="text-sm font-semibold text-red-100">Zona Berbahaya</h3>
              <p className="mt-1 text-xs text-red-200/80">
                Data yang dihapus tidak dapat dikembalikan. Pastikan Anda sudah membuat backup dari
                menu Profil sebelum melanjutkan.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={!hasCriteria || working || preview.students === 0}
            className="dark-btn-danger mt-4 w-full"
          >
            <Trash2 size={16} />
            {working ? 'Memproses…' : 'Hapus Sekarang'}
          </button>
          {!hasCriteria && (
            <p className="mt-2 text-center text-[11px] text-red-200/70">
              Pilih kelas atau tahun ajaran terlebih dahulu.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
