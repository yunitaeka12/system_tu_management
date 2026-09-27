import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CreditCard, Eye, Filter, Search, Trash2, Wallet, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SearchInput from '../components/SearchInput';
import Select from '../components/Select';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import { useDashboardMetrics, usePayments } from '../hooks/usePayments';
import { useFilterOptions } from '../hooks/useStudents';
import { deleteStudentPayments } from '../services/paymentService';
import { useAuth } from '../context/AuthContext';
import { confirmDialog, toast } from '../lib/toast';
import { formatCurrency, formatNumber } from '../utils/currency';
import { PAYMENT_STATUS, PAYMENT_STATUS_LABEL } from '../utils/paymentCalculator';
import { cn } from '../utils/helpers';

function EkskulPills({ names }) {
  if (!names?.length) {
    return <span className="text-xs text-slate-400">Belum ikut ekskul</span>;
  }
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {names.map((nama) => (
        <span key={nama} className="badge bg-primary-50 text-primary-700 ring-1 ring-primary-100">
          {nama}
        </span>
      ))}
    </div>
  );
}

const CURRENT_YEAR = new Date().getFullYear();

/** Sel “SPP Terakhir”: bulan terakhir dibayar + lunas / masih kurang berapa. */
function LastSppCell({ last }) {
  if (!last) return <span className="text-xs text-slate-400">Belum bayar</span>;
  return (
    <div>
      <p className="text-xs font-semibold text-slate-800">
        {last.bulan}
        {last.tahun !== CURRENT_YEAR && (
          <span className="ml-1 font-normal text-slate-500">{last.tahun}</span>
        )}
      </p>
      {last.isFull ? (
        <p className="mt-0.5 text-[11px] font-medium text-school-700">
          Lunas
          {last.adjusted ? ' (adjustment)' : ''}
          {last.extraMonths > 0 ? ` • menutup s/d ${last.coveredThrough}` : ''}
        </p>
      ) : (
        <p className="mt-0.5 text-[11px] font-medium text-amber-600">
          kurang {formatCurrency(last.shortfall)}
        </p>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-800',
    green: 'text-school-700',
    amber: 'text-amber-600',
    red: 'text-red-600',
  };
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('mt-1 truncate text-base font-bold', tones[tone])}>{value}</p>
    </div>
  );
}

export default function Pembayaran() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { kelas: kelasOptions, tahunAjaran: tahunAjaranOptions } = useFilterOptions();
  const metrics = useDashboardMetrics();

  const [search, setSearch] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState('');
  const [kelas, setKelas] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [order, setOrder] = useState({ field: 'nama_lengkap', direction: 'asc' });
  const [showFilters, setShowFilters] = useState(false);

  const { data, total, totalPages, isSearching } = usePayments({
    search,
    tahunAjaran,
    kelas,
    status,
    page,
    pageSize,
    order,
  });

  const activeFilters = [tahunAjaran, kelas, status].filter(Boolean).length;

  const resetPage = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setTahunAjaran('');
    setKelas('');
    setStatus('');
    setPage(1);
  };

  const handleDelete = async (row) => {
    const confirmed = await confirmDialog({
      title: 'Hapus riwayat pembayaran?',
      text:
        `Seluruh transaksi pembayaran ${row.nama_lengkap} (${row.no_induk}) sebanyak ${row.payment_count} transaksi akan dihapus dan sisa tagihan dihitung ulang. Data Buku Induk tetap aman.` +
        (row.adjustment_total > 0
          ? ' Data Adjustment tidak ikut terhapus — hapus dari halaman detail bila memang tidak diperlukan.'
          : ''),
      confirmText: 'Ya, hapus',
    });
    if (!confirmed) return;

    const result = deleteStudentPayments(row.student_id);
    if (result.ok) toast.success(`Riwayat pembayaran ${row.nama_lengkap} berhasil dihapus.`);
    else toast.error(result.error || 'Gagal menghapus riwayat pembayaran.');
  };

  const columns = useMemo(
    () => [
      {
        key: 'no',
        header: 'No',
        className: 'w-14',
        render: (row) => {
          const index = data.findIndex((item) => item.id === row.id);
          return <span className="text-slate-400">{(page - 1) * pageSize + index + 1}</span>;
        },
      },
      {
        key: 'no_induk',
        header: 'No Induk',
        sortable: true,
        render: (row) => <span className="font-medium text-slate-800">{row.no_induk}</span>,
      },
      { key: 'nisn', header: 'NISN', sortable: true, render: (row) => row.nisn || '-' },
      { key: 'kelas', header: 'Kelas', sortable: true },
      {
        key: 'tahun_ajaran',
        header: 'Tahun Ajaran',
        sortable: true,
        render: (row) =>
          row.tahun_ajaran || <span className="text-slate-400">-</span>,
      },
      {
        key: 'nama_lengkap',
        header: 'Nama Lengkap',
        sortable: true,
        render: (row) => (
          <Link
            to={`/pembayaran/${row.student_id}`}
            className="font-medium text-slate-800 transition hover:text-primary-600"
          >
            {row.nama_lengkap}
          </Link>
        ),
      },
      {
        key: 'ekskul_names',
        header: 'Ekskul Saat Ini',
        align: 'center',
        render: (row) => <EkskulPills names={row.ekskul_names} />,
      },
      {
        key: 'annual_fee',
        header: 'Total Tagihan',
        sortable: true,
        align: 'right',
        render: (row) => formatCurrency(row.annual_fee),
      },
      {
        key: 'monthly_fee',
        header: 'Tagihan Bulanan',
        align: 'right',
        render: (row) => <span className="text-slate-500">{formatCurrency(row.monthly_fee)}</span>,
      },
      {
        key: 'total_paid',
        header: 'Total Dibayar',
        sortable: true,
        align: 'right',
        render: (row) => (
          <div>
            <p
              className={cn(
                'font-medium',
                row.total_paid > 0 ? 'text-school-700' : 'text-slate-400',
              )}
            >
              {formatCurrency(row.total_paid)}
            </p>
            {row.adjustment_total > 0 && (
              <p className="mt-0.5 text-[11px] text-slate-500">
                termasuk adjustment {formatCurrency(row.adjustment_total)}
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'remaining',
        header: 'Sisa Tagihan',
        sortable: true,
        align: 'right',
        render: (row) => (
          <span className={cn('font-medium', row.remaining > 0 ? 'text-red-600' : 'text-slate-400')}>
            {formatCurrency(row.remaining)}
          </span>
        ),
      },
      {
        key: 'last_spp_position',
        header: 'SPP Terakhir',
        sortable: true,
        render: (row) => <LastSppCell last={row.last_spp} />,
      },
      {
        key: 'status',
        header: 'Status',
        align: 'center',
        render: (row) => <PaymentStatusBadge status={row.status} compact />,
      },
      {
        key: 'aksi',
        header: 'Aksi',
        align: 'right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1">
            <Link
              to={`/pembayaran/${row.student_id}`}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-primary-50 hover:text-primary-600"
              title="Lihat detail pembayaran"
              aria-label={`Lihat detail pembayaran ${row.nama_lengkap}`}
            >
              <Eye size={16} />
            </Link>
            {can('payment.delete') && (
              <button
                type="button"
                onClick={() => handleDelete(row)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                title="Hapus riwayat pembayaran"
                aria-label={`Hapus riwayat pembayaran ${row.nama_lengkap}`}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, page, pageSize],
  );

  return (
    <div>
      <PageHeader
        title="Pembayaran Siswa"
        subtitle="Data siswa & tagihan diambil otomatis dari Buku Induk — TU hanya mencatat pembayaran."
        badge={<span className="stat-chip">{metrics.activeYear?.nama_tahun_ajaran ?? '-'}</span>}
      />

      <div className="card mb-4 overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-slate-200 lg:grid-cols-4">
          <MiniStat label="Total Tagihan" value={formatCurrency(metrics.totalBilling)} />
          <MiniStat label="Sudah Dibayar" value={formatCurrency(metrics.totalPaid)} tone="green" />
          <MiniStat label="Belum Dibayar" value={formatCurrency(metrics.totalPiutang)} tone="red" />
          <MiniStat
            label="Collection Rate"
            value={`${metrics.collectionRate.toFixed(1).replace('.', ',')}%`}
            tone="amber"
          />
        </div>
      </div>

      <div className="card mb-4 overflow-hidden">
        <div className="grid grid-cols-3 gap-px bg-slate-200">
          {[
            { key: PAYMENT_STATUS.LUNAS, value: metrics.lunas, tone: 'green' },
            { key: PAYMENT_STATUS.SEBAGIAN, value: metrics.sebagian, tone: 'amber' },
            { key: PAYMENT_STATUS.BELUM, value: metrics.belum, tone: 'slate' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setStatus(status === item.key ? '' : item.key);
                setPage(1);
              }}
              className={cn(
                'flex items-center justify-between gap-3 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50',
                status === item.key && 'bg-primary-50/70',
              )}
            >
              <div className="min-w-0">
                <p
                  className={cn(
                    'truncate text-xs font-medium',
                    status === item.key ? 'text-primary-700' : 'text-slate-500',
                  )}
                >
                  {PAYMENT_STATUS_LABEL[item.key]}
                </p>
                <p className="mt-0.5 text-base font-bold text-slate-800">{formatNumber(item.value)}</p>
              </div>
              <Wallet
                size={17}
                className={cn(
                  item.tone === 'green' && 'text-school-500',
                  item.tone === 'amber' && 'text-amber-500',
                  item.tone === 'slate' && 'text-slate-400',
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput
              value={search}
              onChange={resetPage(setSearch)}
              placeholder="Cari No Induk atau Nama Siswa…"
              loading={isSearching}
              className="lg:max-w-md lg:flex-1"
            />
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className={cn('btn-secondary btn-sm', showFilters && 'border-primary-300 bg-primary-50 text-primary-700')}
              >
                <Filter size={15} />
                Filter
                {activeFilters > 0 && (
                  <span className="ml-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
                    {activeFilters}
                  </span>
                )}
              </button>
              {(activeFilters > 0 || search) && (
                <button type="button" onClick={clearFilters} className="btn-ghost btn-sm">
                  <X size={15} />
                  Reset
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
              <div>
                <label htmlFor="pay-filter-tahun" className="label">
                  Tahun Ajaran
                </label>
                <Select
                  id="pay-filter-tahun"
                  value={tahunAjaran}
                  onChange={(e) => resetPage(setTahunAjaran)(e.target.value)}
                  className="input"
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
                <label htmlFor="pay-filter-kelas" className="label">
                  Kelas
                </label>
                <Select
                  id="pay-filter-kelas"
                  value={kelas}
                  onChange={(e) => resetPage(setKelas)(e.target.value)}
                  className="input"
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
                <label htmlFor="pay-filter-status" className="label">
                  Status Pembayaran
                </label>
                <Select
                  id="pay-filter-status"
                  value={status}
                  onChange={(e) => resetPage(setStatus)(e.target.value)}
                  className="input"
                >
                  <option value="">Semua Status</option>
                  <option value={PAYMENT_STATUS.LUNAS}>Lunas</option>
                  <option value={PAYMENT_STATUS.SEBAGIAN}>Sebagian Dibayar</option>
                  <option value={PAYMENT_STATUS.BELUM}>Belum Bayar</option>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DataTable
          columns={columns}
          rows={data}
          loading={isSearching}
          order={order}
          onSort={(field, direction) => setOrder({ field, direction })}
          rowKey={(row) => row.student_id}
          emptyState={
            <EmptyState
              icon={search ? Search : CreditCard}
              title={search || activeFilters ? 'Siswa Tidak Ditemukan' : 'Belum Ada Data Siswa'}
              description={
                search || activeFilters
                  ? 'Coba ubah kata kunci atau reset filter yang aktif.'
                  : 'Import data Buku Induk terlebih dahulu agar tagihan dapat dihitung otomatis.'
              }
              action={
                search || activeFilters ? (
                  <button type="button" onClick={clearFilters} className="btn-secondary btn-sm">
                    Reset pencarian
                  </button>
                ) : (
                  <Link to="/buku-induk/import" className="btn-primary btn-sm">
                    Import Buku Induk
                  </Link>
                )
              }
            />
          }
          onRowClick={(row) => navigate(`/pembayaran/${row.student_id}`)}
          mobileRender={(row) => (
            <Link
              to={`/pembayaran/${row.student_id}`}
              className="flex items-start gap-3 px-4 py-3.5 transition active:bg-slate-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{row.nama_lengkap}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {row.no_induk} • Kelas {row.kelas}
                </p>
                {row.ekskul_names?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {row.ekskul_names.map((nama) => (
                      <span
                        key={nama}
                        className="badge bg-primary-50 text-primary-700 ring-1 ring-primary-100"
                      >
                        {nama}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  <PaymentStatusBadge status={row.status} compact />
                  <span className="text-xs text-slate-500">
                    Sisa <strong className="text-red-600">{formatCurrency(row.remaining)}</strong>
                  </span>
                  {row.adjustment_total > 0 && (
                    <span className="badge bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                      adjustment {formatCurrency(row.adjustment_total)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {row.last_spp ? (
                    <>
                      SPP terakhir:{' '}
                      <strong className="font-semibold text-slate-700">
                        {row.last_spp.bulan}
                        {row.last_spp.tahun !== CURRENT_YEAR ? ` ${row.last_spp.tahun}` : ''}
                      </strong>{' '}
                      {row.last_spp.isFull ? (
                        <span className="text-school-700">
                          • lunas
                          {row.last_spp.extraMonths > 0
                            ? ` (menutup s/d ${row.last_spp.coveredThrough})`
                            : ''}
                        </span>
                      ) : (
                        <span className="text-amber-600">
                          • kurang {formatCurrency(row.last_spp.shortfall)}
                        </span>
                      )}
                    </>
                  ) : (
                    'SPP terakhir: belum bayar'
                  )}
                </p>
              </div>
              <ArrowRight size={16} className="mt-1 shrink-0 text-slate-300" />
            </Link>
          )}
        />

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
