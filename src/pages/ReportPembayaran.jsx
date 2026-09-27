import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Filter,
  History,
  Search,
  Wallet,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SearchInput from '../components/SearchInput';
import Select from '../components/Select';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import { useFilterOptions } from '../hooks/useStudents';
import { usePaymentReport } from '../hooks/usePayments';
import { getPaymentReport } from '../services/paymentService';
import { toast } from '../lib/toast';
import { formatCurrency, formatNumber } from '../utils/currency';
import { PAYMENT_STATUS, PAYMENT_STATUS_LABEL } from '../utils/paymentCalculator';
import { cn, formatDate } from '../utils/helpers';

const PAGE_SIZES = [10, 25, 50, 100];

/** Ringkasan status per periode tahun ajaran: lunas / tunggakan berapa. */
function PeriodBreakdown({ periods }) {
  return (
    <ul className="divide-y divide-slate-100">
      {periods.map((item) => (
        <li
          key={item.period.start}
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5 text-xs"
        >
          <span className="text-slate-600">Periode {item.period.display}</span>
          <span className="flex items-center gap-2">
            <span className="text-slate-400">
              {formatCurrency(item.paid)} / {formatCurrency(item.billed)}
            </span>
            {item.remaining > 0 ? (
              <span className="font-medium text-red-600">
                {item.dues.length} bulan • {formatCurrency(item.remaining)}
              </span>
            ) : (
              <span className="font-medium text-school-600">Lunas</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ReportPembayaran() {
  const { kelas: kelasOptions, tahunAjaran: tahunAjaranOptions } = useFilterOptions();

  const [search, setSearch] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState('');
  const [kelas, setKelas] = useState('');
  const [status, setStatus] = useState('');
  const [all, setAll] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expanded, setExpanded] = useState(null);

  const report = usePaymentReport({
    search,
    tahunAjaran,
    kelas,
    status,
    page,
    pageSize,
    all,
  });

  const { data, total, totalPages, totals } = report;

  const resetPage = (setter) => (value) => {
    setter(value);
    setPage(1);
    setExpanded(null);
  };

  const handleExport = () => {
    try {
      const full = getPaymentReport({
        search,
        tahunAjaran,
        kelas,
        status,
        all: true,
        order: { field: 'nama_lengkap', direction: 'asc' },
      });

      const rekap = full.data.map((row, index) => ({
        No: index + 1,
        'No Induk': row.no_induk,
        NISN: row.nisn || '',
        'Nama Lengkap': row.nama_lengkap,
        Kelas: row.kelas,
        'Tahun Ajaran': row.tahun_ajaran || '',
        'Total Tagihan': row.annualFee,
        'Sudah Dibayar': row.totalPaid,
        'Sisa Tagihan': row.remaining,
        'Bulan Terbayar': `${row.paidMonthCount}/${row.totalMonths}`,
        'Bulan Tunggakan': row.unpaidMonthCount,
        'Tunggakan per Periode': row.periodDetails
          .map(
            (item) =>
              `${item.period.label}: ${
                item.remaining > 0
                  ? `${item.dues.length} bulan ${item.remaining}`
                  : 'Lunas'
              }`,
          )
          .join(' | '),
        Status: PAYMENT_STATUS_LABEL[row.status] ?? row.status,
      }));

      const riwayat = full.data.flatMap((row) =>
        row.history.map((item) => ({
          'No Induk': row.no_induk,
          Nama: row.nama_lengkap,
          Kelas: row.kelas,
          Bulan: item.bulan,
          Tahun: item.tahun ?? '',
          Jenis:
            item.kind === 'spp'
              ? 'SPP'
              : item.kind === 'lain'
                ? 'Pembayaran Lain'
                : item.kind === 'ekskul'
                  ? `Ekskul ${item.ekskul_nama ?? ''}`.trim()
                  : 'Adjustment',
          Nominal: item.nominal,
          'Tanggal Bayar': item.tanggal || '',
          Petugas: item.petugas || '',
          Keterangan: item.keterangan || '',
        })),
      );

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rekap), 'Rekap Pembayaran');
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(riwayat),
        'Riwayat Pembayaran',
      );
      XLSX.writeFile(
        workbook,
        `Report_Pembayaran_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast.success(`${formatNumber(full.total)} baris siswa & riwayatnya berhasil diexport.`);
    } catch (error) {
      toast.error('Gagal membuat file Excel. Coba kurangi filter terlebih dahulu.');
      console.error(error);
    }
  };

  return (
    <div>
      <PageHeader
        title="Report Pembayaran"
        subtitle="Rekap tagihan, pembayaran, riwayat transaksi, dan sisa tagihan per periode tahun ajaran."
        actions={
          <button type="button" onClick={handleExport} className="btn-primary btn-sm">
            <Download size={15} />
            Export Excel
          </button>
        }
      />

      {/* Ringkasan */}
      <div className="card mb-5 grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x">
        {[
          { label: 'Total Tagihan', value: formatCurrency(totals.billing), tone: 'text-slate-800' },
          { label: 'Sudah Dibayar', value: formatCurrency(totals.paid), tone: 'text-school-700' },
          { label: 'Sisa Tagihan', value: formatCurrency(totals.remaining), tone: 'text-red-600' },
          {
            label: 'Siswa Menunggak',
            value: `${formatNumber(totals.studentsWithDues)} siswa`,
            tone: 'text-amber-600',
          },
        ].map((item) => (
          <div key={item.label} className="px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {item.label}
            </p>
            <p className={cn('mt-1 truncate text-lg font-bold', item.tone)}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="card mb-5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[220px] flex-1">
            <SearchInput
              value={search}
              onChange={resetPage(setSearch)}
              placeholder="Cari nama, No Induk, atau NISN…"
            />
          </div>
          <Select
            value={tahunAjaran}
            onChange={(event) => resetPage(setTahunAjaran)(event.target.value)}
            ariaLabel="Filter tahun ajaran"
            className="input w-full sm:w-[190px]"
          >
            <option value="">Semua Tahun Ajaran</option>
            {tahunAjaranOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Select
            value={kelas}
            onChange={(event) => resetPage(setKelas)(event.target.value)}
            ariaLabel="Filter kelas"
            className="input w-full sm:w-[150px]"
          >
            <option value="">Semua Kelas</option>
            {kelasOptions.map((item) => (
              <option key={item} value={item}>
                Kelas {item}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(event) => resetPage(setStatus)(event.target.value)}
            ariaLabel="Filter status pembayaran"
            className="input w-full sm:w-[170px]"
          >
            <option value="">Semua Status</option>
            {Object.values(PAYMENT_STATUS).map((value) => (
              <option key={value} value={value}>
                {PAYMENT_STATUS_LABEL[value]}
              </option>
            ))}
          </Select>
          <Select
            value={all ? 'all' : String(pageSize)}
            onChange={(event) => {
              const value = event.target.value;
              setPage(1);
              setExpanded(null);
              if (value === 'all') {
                setAll(true);
              } else {
                setAll(false);
                setPageSize(Number(value));
              }
            }}
            ariaLabel="Jumlah data per halaman"
            className="input w-full sm:w-[190px]"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} data per halaman
              </option>
            ))}
            <option value="all">Semua data ({formatNumber(total)})</option>
          </Select>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <Filter size={13} />
          {formatNumber(total)} siswa sesuai filter
          {all ? ' • ditampilkan seluruhnya' : ` • ${pageSize} data per halaman`}
        </p>
      </div>

      {data.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Search}
            title="Tidak Ada Data"
            description="Tidak ada siswa yang cocok dengan filter yang dipilih."
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="table-head w-10" />
                  <th className="table-head">No Induk</th>
                  <th className="table-head">NISN</th>
                  <th className="table-head">Nama Lengkap</th>
                  <th className="table-head">Kelas</th>
                  <th className="table-head">Tahun Ajaran</th>
                  <th className="table-head text-right">Total Tagihan</th>
                  <th className="table-head text-right">Sudah Dibayar</th>
                  <th className="table-head text-right">Sisa Tagihan</th>
                  <th className="table-head">Status</th>
                  <th className="table-head text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  const open = expanded === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={cn(
                          'border-b border-slate-100 transition-colors hover:bg-slate-50',
                          open && 'bg-slate-50',
                        )}
                      >
                        <td className="table-cell">
                          <button
                            type="button"
                            onClick={() => setExpanded(open ? null : row.id)}
                            aria-expanded={open}
                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100"
                            title={open ? 'Tutup detail' : 'Lihat detail pembayaran'}
                          >
                            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>
                        <td className="table-cell font-medium text-slate-800">{row.no_induk}</td>
                        <td className="table-cell text-slate-500">{row.nisn || '-'}</td>
                        <td className="table-cell font-medium text-slate-800">
                          {row.nama_lengkap}
                        </td>
                        <td className="table-cell">{row.kelas}</td>
                        <td className="table-cell">{row.tahun_ajaran || '-'}</td>
                        <td className="table-cell text-right">{formatCurrency(row.annualFee)}</td>
                        <td className="table-cell text-right font-semibold text-school-700">
                          {formatCurrency(row.totalPaid)}
                        </td>
                        <td
                          className={cn(
                            'table-cell text-right font-semibold',
                            row.remaining > 0 ? 'text-red-600' : 'text-school-700',
                          )}
                        >
                          {formatCurrency(row.remaining)}
                        </td>
                        <td className="table-cell">
                          <PaymentStatusBadge status={row.status} compact />
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center justify-end">
                            <Link
                              to={`/pembayaran/${row.student_id}`}
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-primary-50 hover:text-primary-600"
                              title="Buka detail pembayaran siswa"
                            >
                              <Eye size={15} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-slate-200 bg-slate-50/70">
                          <td colSpan={11} className="px-4 py-4">
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.18 }}
                              className="grid grid-cols-1 gap-4 lg:grid-cols-2"
                            >
                              <div className="card card-pad">
                                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  <Wallet size={14} />
                                  Tagihan per Periode Tahun Ajaran
                                </h3>
                                <div className="mt-2">
                                  <PeriodBreakdown periods={row.periodDetails} />
                                </div>
                                <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
                                  <div>
                                    <dt className="text-slate-400">Bulan terbayar</dt>
                                    <dd className="font-semibold text-slate-700">
                                      {row.paidMonthCount} / {row.totalMonths}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-slate-400">Pembayaran lain-lain</dt>
                                    <dd className="font-semibold text-slate-700">
                                      {formatCurrency(row.otherTotal)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-slate-400">Adjustment</dt>
                                    <dd className="font-semibold text-slate-700">
                                      {formatCurrency(row.adjustmentTotal)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-slate-400">Ekskul</dt>
                                    <dd className="font-semibold text-slate-700">
                                      {row.ekskul_names?.length
                                        ? row.ekskul_names.join(', ')
                                        : 'Tidak ada'}
                                    </dd>
                                  </div>
                                </dl>
                              </div>

                              <div className="card card-pad">
                                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  <History size={14} />
                                  History Bayar ({row.history.length})
                                </h3>
                                {row.history.length === 0 ? (
                                  <p className="mt-2 text-xs text-slate-400">
                                    Belum ada transaksi pembayaran.
                                  </p>
                                ) : (
                                  <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                                    {row.history.map((item) => (
                                      <li
                                        key={item.key}
                                        className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-white px-2.5 py-2"
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate text-xs font-semibold text-slate-700">
                                            {item.bulan} {item.tahun ?? ''}
                                          </p>
                                          <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                            {item.kind === 'spp'
                                              ? 'SPP'
                                              : item.kind === 'lain'
                                                ? 'Pembayaran Lain'
                                                : item.kind === 'ekskul'
                                                  ? `Ekskul ${item.ekskul_nama ?? ''}`.trim()
                                                  : 'Adjustment'}
                                            {item.keterangan ? ` • ${item.keterangan}` : ''}
                                            {item.tanggal
                                              ? ` • ${formatDate(item.tanggal)}`
                                              : ''}
                                          </p>
                                        </div>
                                        <span className="shrink-0 text-xs font-semibold text-school-700">
                                          {formatCurrency(item.nominal)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!all && (
            <Pagination
              page={report.page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              pageSizes={PAGE_SIZES}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
