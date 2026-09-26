import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, Eye, Filter, Search, Trash2, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { useEkskulRows, useEkskulStats } from '../hooks/useEkskul';
import { useFilterOptions } from '../hooks/useStudents';
import { removeStudentEkskul } from '../services/ekskulService';
import { useAuth } from '../context/AuthContext';
import { confirmDialog, toast } from '../lib/toast';
import { formatCurrency, formatNumber } from '../utils/currency';
import { cn } from '../utils/helpers';

function MiniStat({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-800',
    green: 'text-school-700',
    amber: 'text-amber-600',
    primary: 'text-primary-700',
  };
  return (
    <div className="card px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn('mt-1 truncate text-base font-bold', tones[tone])}>{value}</p>
    </div>
  );
}

function EkskulPills({ row }) {
  if (!row.ekskul_names.length) {
    return <span className="text-xs text-slate-400">Belum ikut ekskul</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {row.ekskul_names.map((nama) => (
        <span
          key={nama}
          className="badge bg-primary-50 text-primary-700 ring-1 ring-primary-100"
        >
          {nama}
        </span>
      ))}
    </div>
  );
}

export default function Ekskul() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { kelas: kelasOptions, tahunAjaran: tahunAjaranOptions } = useFilterOptions();
  const stats = useEkskulStats();

  const [search, setSearch] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState('');
  const [kelas, setKelas] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [order, setOrder] = useState({ field: 'nama_lengkap', direction: 'asc' });
  const [showFilters, setShowFilters] = useState(false);

  const { data, total, totalPages, isSearching } = useEkskulRows({
    search,
    tahunAjaran,
    kelas,
    page,
    pageSize,
    order,
  });

  const activeFilters = [tahunAjaran, kelas].filter(Boolean).length;

  const resetPage = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setTahunAjaran('');
    setKelas('');
    setPage(1);
  };

  const handleDelete = async (row) => {
    const confirmed = await confirmDialog({
      title: 'Hapus data ekskul?',
      text: `${row.nama_lengkap} akan dikeluarkan dari ${row.ekskul_names.join(', ')}. Riwayat pembayaran ekskulnya ikut terhapus. Data Buku Induk tetap aman.`,
      confirmText: 'Ya, hapus',
    });
    if (!confirmed) return;

    const result = removeStudentEkskul(row.student_id);
    if (result.ok) toast.success(`Data ekskul ${row.nama_lengkap} berhasil dihapus.`);
    else toast.error(result.error || 'Gagal menghapus data ekskul.');
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
      {
        key: 'nama_lengkap',
        header: 'Nama Siswa',
        sortable: true,
        render: (row) => (
          <Link
            to={`/ekskul/${row.student_id}`}
            className="font-medium text-slate-800 transition hover:text-primary-600"
          >
            {row.nama_lengkap}
          </Link>
        ),
      },
      {
        key: 'ekskul_names',
        header: 'Ekskul Saat Ini',
        render: (row) => <EkskulPills row={row} />,
      },
      {
        key: 'ekskul_fee',
        header: 'Biaya / Bulan',
        align: 'right',
        render: (row) =>
          row.ekskul_fee > 0 ? (
            formatCurrency(row.ekskul_fee)
          ) : (
            <span className="text-slate-400">-</span>
          ),
      },
      {
        key: 'ekskul_paid',
        header: 'Sudah Dibayar',
        align: 'right',
        render: (row) => (
          <span className={cn('font-medium', row.ekskul_paid > 0 ? 'text-school-700' : 'text-slate-400')}>
            {formatCurrency(row.ekskul_paid)}
          </span>
        ),
      },
      {
        key: 'aksi',
        header: 'Aksi',
        align: 'right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1">
            <Link
              to={`/ekskul/${row.student_id}`}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-primary-50 hover:text-primary-600"
              title="Lihat detail ekskul"
              aria-label={`Lihat detail ekskul ${row.nama_lengkap}`}
            >
              <Eye size={16} />
            </Link>
            {can('payment.delete') && (
              <button
                type="button"
                onClick={() => handleDelete(row)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                title="Hapus data ekskul"
                aria-label={`Hapus ekskul ${row.nama_lengkap}`}
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
        title="Ekskul Siswa"
        subtitle="Kegiatan ekstrakurikuler siswa beserta pembayaran bulanannya."
        badge={<span className="stat-chip">{formatNumber(stats.participants)} peserta</span>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Peserta Ekskul" value={formatNumber(stats.participants)} tone="primary" />
        <MiniStat label="Total Pendaftaran" value={formatNumber(stats.enrollments)} />
        <MiniStat label="Total Dibayar" value={formatCurrency(stats.totalPaid)} tone="green" />
        <MiniStat
          label="Ekskul Terpopuler"
          value={stats.popular[0] ? stats.popular[0].nama : '-'}
          tone="amber"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput
              value={search}
              onChange={resetPage(setSearch)}
              placeholder="Cari No Induk, NISN, nama siswa, atau ekskul…"
              loading={isSearching}
              className="lg:max-w-md lg:flex-1"
            />
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className={cn(
                  'btn-secondary btn-sm',
                  showFilters && 'border-primary-300 bg-primary-50 text-primary-700',
                )}
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
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
              <div>
                <label htmlFor="eks-filter-tahun" className="label">
                  Tahun Ajaran
                </label>
                <select
                  id="eks-filter-tahun"
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
                </select>
              </div>
              <div>
                <label htmlFor="eks-filter-kelas" className="label">
                  Kelas
                </label>
                <select
                  id="eks-filter-kelas"
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
                </select>
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
              icon={search ? Search : Award}
              title={search || activeFilters ? 'Siswa Tidak Ditemukan' : 'Belum Ada Data Ekskul'}
              description={
                search || activeFilters
                  ? 'Coba ubah kata kunci atau reset filter yang aktif.'
                  : 'Buka detail siswa lalu tambahkan ekskul yang diikuti.'
              }
            />
          }
          onRowClick={(row) => navigate(`/ekskul/${row.student_id}`)}
          mobileRender={(row) => (
            <Link
              to={`/ekskul/${row.student_id}`}
              className="block px-4 py-3.5 transition active:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{row.nama_lengkap}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {row.no_induk} • Kelas {row.kelas}
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <EkskulPills row={row} />
              </div>
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
