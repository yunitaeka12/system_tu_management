import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { formatNumber } from '../utils/currency';
import { cn } from '../utils/helpers';
import { toast } from '../lib/toast';
import {
  buildImportPreview,
  buildTemplateWorkbook,
  executeImport,
  parseWorkbookFile,
} from '../services/importService';

const STEPS = [
  { key: 'upload', label: 'Upload Excel' },
  { key: 'preview', label: 'Preview & Validasi' },
  { key: 'import', label: 'Import' },
  { key: 'done', label: 'Selesai' },
];

const PREVIEW_LIMIT = 50;

function StepBar({ step }) {
  const activeIndex = STEPS.findIndex((s) => s.key === step);
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {STEPS.map((item, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;
        return (
          <div key={item.key} className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition',
                isActive && 'bg-primary-600 text-white',
                isDone && 'bg-school-50 text-school-700',
                !isActive && !isDone && 'bg-slate-100 text-slate-500',
              )}
            >
              <span
                className={cn(
                  'grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold',
                  isActive && 'bg-white/20 text-white',
                  isDone && 'bg-school-600 text-white',
                  !isActive && !isDone && 'bg-white text-slate-500',
                )}
              >
                {isDone ? <CheckCircle2 size={12} /> : index + 1}
              </span>
              {item.label}
            </div>
            {index < STEPS.length - 1 && <div className="hidden h-px w-5 bg-slate-200 sm:block" />}
          </div>
        );
      })}
    </div>
  );
}

function SummaryTile({ label, value, tone = 'slate', icon: Icon }) {
  const tones = {
    slate: 'text-slate-800',
    green: 'text-school-700',
    amber: 'text-amber-600',
    red: 'text-red-600',
    primary: 'text-primary-700',
  };
  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
        {Icon && <Icon size={15} className="text-slate-300" />}
      </div>
      <p className={cn('mt-1 text-xl font-bold', tones[tone])}>{formatNumber(value)}</p>
    </div>
  );
}

export default function ImportBukuInduk() {
  const inputRef = useRef(null);
  const [step, setStep] = useState('upload');
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState('skip');
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => {
    setStep('upload');
    setParsed(null);
    setPreview(null);
    setResult(null);
    setFileName('');
    setProgress({ done: 0, total: 0 });
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file) => {
    if (!file) return;
    const isExcel = /\.(xlsx|xls|xlsm|csv)$/i.test(file.name);
    if (!isExcel) {
      toast.error('Format file harus .xlsx, .xls, atau .csv.');
      return;
    }

    setParsing(true);
    setFileName(file.name);
    try {
      const parsedResult = await parseWorkbookFile(file);
      setParsed(parsedResult);
      setPreview(buildImportPreview(parsedResult, { mode }));
      setStep('preview');
    } catch (error) {
      console.error(error);
      toast.error('Gagal membaca file Excel. Pastikan struktur kolom sesuai template.');
    } finally {
      setParsing(false);
    }
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    if (parsed) setPreview(buildImportPreview(parsed, { mode: nextMode }));
  };

  const handleImport = async () => {
    if (!preview) return;
    const total = preview.valid.length + (mode === 'update' ? preview.duplicates.length : 0);
    if (total === 0) {
      toast.warning('Tidak ada data yang bisa diimport.');
      return;
    }

    setImporting(true);
    setStep('import');
    setProgress({ done: 0, total });

    const importResult = await executeImport(preview, {
      mode,
      onProgress: (done, all) => setProgress({ done, total: all }),
    });

    setImporting(false);
    setResult(importResult);
    setStep('done');
    toast.success(`Import selesai — ${formatNumber(importResult.inserted)} data baru ditambahkan.`);
  };

  const downloadTemplate = () => {
    const workbook = buildTemplateWorkbook();
    XLSX.writeFile(workbook, 'Template_Buku_Induk_As-Salam.xlsx');
    toast.success('Template Excel berhasil diunduh.');
  };

  const progressPercent = progress.total
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

  return (
    <div>
      <PageHeader
        title="Import Data Buku Induk"
        subtitle="Unggah file Excel Buku Induk, tinjau validasi, lalu konfirmasi sebelum data masuk."
        actions={
          <>
            <button type="button" onClick={downloadTemplate} className="btn-secondary btn-sm">
              <Download size={15} />
              Template Excel
            </button>
            <Link to="/buku-induk" className="btn-ghost btn-sm">
              <ArrowLeft size={15} />
              Kembali
            </Link>
          </>
        }
      />

      <StepBar step={step} />

      <AnimatePresence mode="wait">
        {/* STEP 1 — UPLOAD */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="card p-6"
          >
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition',
                dragging
                  ? 'border-primary-400 bg-primary-50/70'
                  : 'border-slate-300 bg-slate-50/60 hover:border-primary-300 hover:bg-primary-50/40',
              )}
            >
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-primary-600 shadow-card">
                {parsing ? <Loader2 size={26} className="animate-spin" /> : <Upload size={26} />}
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-800">
                {parsing ? 'Membaca file Excel…' : 'Tarik & lepas file Excel di sini'}
              </h2>
              <p className="mt-1.5 max-w-md text-sm text-slate-500">
                Format .xlsx / .xls. Struktur kolom mengikuti file Buku Induk As-Salam
                (kelompok AYAH, IBU, Alamat Orang Tua, Wali, dan Data Fisik).
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={parsing}
                className="btn-primary mt-5"
              >
                <FileSpreadsheet size={16} />
                Pilih File Excel
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm,.csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { title: '1. Upload', text: 'Pilih file Buku Induk dari komputer Anda.' },
                { title: '2. Validasi', text: 'Sistem memeriksa kolom, No Induk, dan NISN.' },
                { title: '3. Konfirmasi', text: 'Tinjau hasil preview, baru data disimpan.' },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* STEP 2 — PREVIEW */}
        {step === 'preview' && preview && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-school-50 text-school-600">
                  <FileSpreadsheet size={19} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{fileName}</p>
                  <p className="text-xs text-slate-500">
                    Sheet <strong>{parsed.sheetName}</strong> •{' '}
                    {formatNumber(parsed.totalRows)} baris terbaca
                  </p>
                </div>
              </div>
              <button type="button" onClick={reset} className="btn-secondary btn-sm shrink-0">
                <RefreshCw size={15} />
                Ganti File
              </button>
            </div>

            {parsed.missingColumns?.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p>
                  Kolom berikut tidak terdeteksi:{' '}
                  <strong>{parsed.missingColumns.join(', ')}</strong>. Pastikan urutan kolom sesuai
                  template agar data terbaca dengan benar.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <SummaryTile label="Total Baris" value={parsed.totalRows} />
              <SummaryTile label="Data Valid" value={preview.summary.validCount} tone="green" />
              <SummaryTile label="Duplikat No Induk" value={preview.summary.duplicateCount} tone="amber" />
              <SummaryTile label="Baris Error" value={preview.summary.invalidCount} tone="red" />
              <SummaryTile
                label={mode === 'update' ? 'Akan Diperbarui' : 'Akan Ditambahkan'}
                value={
                  mode === 'update'
                    ? preview.summary.updateCount
                    : preview.summary.newCount
                }
                tone="primary"
              />
            </div>

            {/* Mode penanganan duplikat */}
            <div className="card p-5">
              <p className="text-sm font-semibold text-slate-800">
                Jika No Induk sudah ada di database
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Terdeteksi {formatNumber(preview.summary.duplicateCount)} No Induk yang sudah
                terdaftar. Pilih tindakan yang diinginkan.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { value: 'skip', label: 'Skip', text: 'Lewati data yang sudah ada.' },
                  { value: 'update', label: 'Update', text: 'Perbarui data siswa yang sudah ada.' },
                  { value: 'cancel', label: 'Cancel', text: 'Batalkan proses import.' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (option.value === 'cancel') {
                        reset();
                        return;
                      }
                      handleModeChange(option.value);
                    }}
                    className={cn(
                      'rounded-xl border p-3.5 text-left transition',
                      mode === option.value
                        ? 'border-primary-500 bg-primary-50/70 ring-1 ring-primary-500'
                        : 'border-slate-200 bg-white hover:border-slate-300',
                    )}
                  >
                    <p className="text-sm font-semibold text-slate-800">{option.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{option.text}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Tabel preview */}
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-800">Preview Data</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Menampilkan {Math.min(preview.valid.length, PREVIEW_LIMIT)} dari{' '}
                  {formatNumber(preview.valid.length)} data valid
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead className="border-b border-slate-200 bg-slate-50/70">
                    <tr>
                      <th className="table-head w-16">Baris</th>
                      <th className="table-head">No Induk</th>
                      <th className="table-head">NISN</th>
                      <th className="table-head">Nama Lengkap</th>
                      <th className="table-head">Kelas</th>
                      <th className="table-head">JK</th>
                      <th className="table-head">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.valid.slice(0, PREVIEW_LIMIT).map((item) => (
                      <tr key={`${item.student.no_induk}-${item.rowNumber}`} className="border-b border-slate-100 last:border-0">
                        <td className="table-cell text-slate-400">{item.rowNumber}</td>
                        <td className="table-cell font-medium text-slate-800">{item.student.no_induk}</td>
                        <td className="table-cell">{item.student.nisn || '-'}</td>
                        <td className="table-cell max-w-[260px] truncate">{item.student.nama_lengkap}</td>
                        <td className="table-cell">{item.student.kelas}</td>
                        <td className="table-cell">{item.student.jenis_kelamin || '-'}</td>
                        <td className="table-cell">
                          <span className="badge bg-school-50 text-school-700 ring-1 ring-school-200">
                            <CheckCircle2 size={12} />
                            Siap
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.valid.length === 0 && (
                  <EmptyState
                    icon={FileSpreadsheet}
                    title="Tidak Ada Data Valid"
                    description="Semua baris bermasalah atau file tidak sesuai template."
                  />
                )}
              </div>
            </div>

            {/* Error list */}
            {preview.invalid.length > 0 && (
              <div className="card overflow-hidden">
                <div className="flex items-center gap-2.5 border-b border-slate-200 bg-red-50/60 px-5 py-4">
                  <AlertCircle size={17} className="text-red-600" />
                  <div>
                    <h2 className="text-sm font-semibold text-red-800">
                      {formatNumber(preview.invalid.length)} baris tidak valid
                    </h2>
                    <p className="text-xs text-red-600/80">
                      Baris ini akan dilewati dan tidak mengganggu data lain.
                    </p>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full min-w-[560px]">
                    <thead className="sticky top-0 border-b border-slate-200 bg-slate-50/90">
                      <tr>
                        <th className="table-head w-16">Baris</th>
                        <th className="table-head">No Induk</th>
                        <th className="table-head">Nama</th>
                        <th className="table-head">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.invalid.slice(0, 100).map((item) => (
                        <tr key={`err-${item.rowNumber}`} className="border-b border-slate-100 last:border-0">
                          <td className="table-cell text-slate-400">{item.rowNumber}</td>
                          <td className="table-cell">{item.student.no_induk || '-'}</td>
                          <td className="table-cell max-w-[200px] truncate">
                            {item.student.nama_lengkap || '-'}
                          </td>
                          <td className="table-cell whitespace-normal text-red-600">
                            {item.errors.join('; ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Duplikat list */}
            {preview.duplicates.length > 0 && (
              <div className="card overflow-hidden">
                <div className="flex items-center gap-2.5 border-b border-slate-200 bg-amber-50/60 px-5 py-4">
                  <Copy size={17} className="text-amber-600" />
                  <div>
                    <h2 className="text-sm font-semibold text-amber-800">
                      {formatNumber(preview.duplicates.length)} No Induk sudah terdaftar
                    </h2>
                    <p className="text-xs text-amber-700/80">
                      Mode saat ini:{' '}
                      <strong>{mode === 'update' ? 'Update data lama' : 'Skip (lewati)'}</strong>
                    </p>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full min-w-[560px]">
                    <thead className="sticky top-0 border-b border-slate-200 bg-slate-50/90">
                      <tr>
                        <th className="table-head w-16">Baris</th>
                        <th className="table-head">No Induk</th>
                        <th className="table-head">Data di Database</th>
                        <th className="table-head">Data di Excel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.duplicates.slice(0, 100).map((item) => (
                        <tr key={`dup-${item.rowNumber}`} className="border-b border-slate-100 last:border-0">
                          <td className="table-cell text-slate-400">{item.rowNumber}</td>
                          <td className="table-cell font-medium">{item.student.no_induk}</td>
                          <td className="table-cell max-w-[220px] truncate text-slate-500">
                            {item.existing.nama_lengkap} • {item.existing.kelas}
                          </td>
                          <td className="table-cell max-w-[220px] truncate">
                            {item.student.nama_lengkap} • {item.student.kelas}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action bar */}
            <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Siap mengimport{' '}
                <strong className="text-slate-900">
                  {formatNumber(preview.readyToImport)}
                </strong>{' '}
                data
                {preview.summary.invalidCount > 0 && (
                  <span className="text-slate-400">
                    {' '}
                    • {formatNumber(preview.summary.invalidCount)} baris dilewati
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={reset} className="btn-secondary">
                  <X size={16} />
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={preview.readyToImport === 0}
                  className="btn-primary"
                >
                  <Upload size={16} />
                  Konfirmasi Import
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3 — IMPORTING */}
        {step === 'import' && (
          <motion.div
            key="import"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="card card-pad"
          >
            <div className="flex flex-col items-center py-8 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-50 text-primary-600">
                <Loader2 size={26} className="animate-spin" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-800">Importing data…</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                <strong className="font-semibold text-slate-700">
                  {formatNumber(progress.done)} / {formatNumber(progress.total)}
                </strong>{' '}
                records
              </p>

              <div className="mt-6 w-full max-w-md">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <motion.div
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.2 }}
                    className="h-full rounded-full bg-primary-600"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400">{progressPercent}% selesai</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 4 — DONE */}
        {step === 'done' && result && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card card-pad"
          >
            <div className="flex flex-col items-center py-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                className="grid h-16 w-16 place-items-center rounded-full bg-school-50 text-school-600"
              >
                <CheckCircle2 size={32} />
              </motion.div>
              <h2 className="mt-4 text-lg font-bold text-slate-900">Import Berhasil</h2>
              <p className="mt-1.5 max-w-md text-sm text-slate-500">
                Data Buku Induk telah diperbarui. Seluruh tagihan dan status pembayaran dihitung
                ulang secara otomatis.
              </p>

              <div className="mt-6 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryTile label="Ditambahkan" value={result.inserted} tone="green" />
                <SummaryTile label="Diperbarui" value={result.updated} tone="primary" />
                <SummaryTile label="Dilewati" value={result.skipped + result.failed} tone="amber" />
                <SummaryTile label="Gagal" value={result.failed} tone="red" />
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={reset} className="btn-secondary">
                  <RefreshCw size={16} />
                  Import File Lain
                </button>
                <Link to="/buku-induk" className="btn-primary">
                  <CheckCircle2 size={16} />
                  Lihat Buku Induk
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
