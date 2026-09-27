import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Eye, FileSpreadsheet, Filter, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SearchInput from '../components/SearchInput';
import Select from '../components/Select';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { useFilterOptions, useStudents } from '../hooks/useStudents';
import { deleteStudent } from '../services/studentService';
import { useAuth } from '../context/AuthContext';
import { confirmDialog, toast } from '../lib/toast';
import { formatNumber } from '../utils/currency';
import { cn } from '../utils/helpers';

function GenderPill({ value }) {
  if (!value) return <span className="text-slate-400">-</span>;
  const isMale = value === 'Laki-laki';
  return (
    <span
      className={cn(
        'badge',
        isMale ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200' : 'bg-pink-50 text-pink-700 ring-1 ring-pink-200',
      )}
    >
      {isMale ? 'L' : 'P'}
    </span>
  );
}

function ActionButtons({ student, can, onDelete }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        to={`/buku-induk/${student.id}`}
        className="rounded-lg p-2 text-slate-500 transition hover:bg-primary-50 hover:text-primary-600"
        title="Lihat detail"
        aria-label={`Lihat detail ${student.nama_lengkap}`}
      >
        <Eye size={16} />
      </Link>
      {can('student.update') && (
        <Link
          to={`/buku-induk/${student.id}/edit`}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-amber-50 hover:text-amber-600"
          title="Edit data"
          aria-label={`Edit ${student.nama_lengkap}`}
        >
          <Pencil size={16} />
        </Link>
      )}
      {can('student.delete') && (
        <button
          type="button"
          onClick={() => onDelete(student)}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
          title="Hapus data"
          aria-label={`Hapus ${student.nama_lengkap}`}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

export default function BukuInduk() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const {
    kelas: kelasOptions,
    rombel: rombelOptions,
    tahunAjaran: tahunAjaranOptions,
  } = useFilterOptions();

  const [search, setSearch] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState('');
  const [kelas, setKelas] = useState('');
  const [rombel, setRombel] = useState('');
  const [jenisKelamin, setJenisKelamin] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [order, setOrder] = useState({ field: 'nama_lengkap', direction: 'asc' });
  const [showFilters, setShowFilters] = useState(false);

  const { data, total, totalPages, isSearching } = useStudents({
    search,
    tahunAjaran,
    kelas,
    rombel,
    jenisKelamin,
    page,
    pageSize,
    order,
  });

  const activeFilters = [tahunAjaran, kelas, rombel, jenisKelamin].filter(Boolean).length;

  const resetPage = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setTahunAjaran('');
    setKelas('');
    setRombel('');
    setJenisKelamin('');
    setSearch('');
    setPage(1);
  };

  const handleSort = (field, direction) => setOrder({ field, direction });

  const handleDelete = async (student) => {
    const confirmed = await confirmDialog({
      title: 'Hapus data siswa?',
      text: `${student.nama_lengkap} (${student.no_induk}) akan dihapus beserta seluruh riwayat pembayarannya. Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Ya, hapus',
      icon: 'warning',
    });
    if (!confirmed) return;

    const result = deleteStudent(student.id);
    if (result.ok) {
      toast.success(`Data ${student.nama_lengkap} berhasil dihapus.`);
    } else {
      toast.error(result.error || 'Gagal menghapus data siswa.');
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'no',
        header: 'No',
        className: 'w-14',
        render: (row) => {
          const index = data.findIndex((item) => item.id === row.id);
          return (
            <span className="text-slate-400">{(page - 1) * pageSize + index + 1}</span>
          );
        },
      },
      { key: 'no_induk', header: 'No Induk', sortable: true, render: (row) => (
        <span className="font-medium text-slate-800">{row.no_induk}</span>
      ) },
      { key: 'nisn', header: 'NISN', sortable: true, render: (row) => row.nisn || <span className="text-slate-400">-</span> },
      {
        key: 'nama_lengkap',
        header: 'Nama Lengkap',
        sortable: true,
        render: (row) => (
          <Link
            to={`/buku-induk/${row.id}`}
            className="font-medium text-slate-800 transition hover:text-primary-600"
          >
            {row.nama_lengkap}
          </Link>
        ),
      },
      { key: 'kelas', header: 'Kelas', sortable: true },
      { key: 'rombel', header: 'Rombel', sortable: true, render: (row) => row.rombel || <span className="text-slate-400">-</span> },
      {
        key: 'jenis_kelamin',
        header: 'JK',
        align: 'center',
        render: (row) => <GenderPill value={row.jenis_kelamin} />,
      },
      {
        key: 'aksi',
        header: 'Aksi',
        align: 'right',
        render: (row) => <ActionButtons student={row} can={can} onDelete={handleDelete} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, page, pageSize],
  );

  return (
    <div>
      <PageHeader
        title="Buku Induk Siswa"
        subtitle={`Master data seluruh siswa — ${formatNumber(total)} siswa${
          activeFilters ? ` (${activeFilters} filter aktif)` : ''
        }`}
        actions={
          <>
            {can('student.import') && (
              <Link to="/buku-induk/import" className="btn-secondary btn-sm">
                <FileSpreadsheet size={15} />
                Import Excel
              </Link>
            )}
            {can('student.create') && (
              <Link to="/buku-induk/baru" className="btn-primary btn-sm">
                <UserPlus size={15} />
                Tambah Siswa
              </Link>
            )}
          </>
        }
      />

      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput
              value={search}
              onChange={resetPage(setSearch)}
              placeholder="Cari No Induk, NISN, atau Nama Lengkap…"
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
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="filter-tahun" className="label">
                  Tahun Ajaran
                </label>
                <Select
                  id="filter-tahun"
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
                <label htmlFor="filter-kelas" className="label">
                  Kelas
                </label>
                <Select
                  id="filter-kelas"
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
                <label htmlFor="filter-rombel" className="label">
                  Rombel
                </label>
                <Select
                  id="filter-rombel"
                  value={rombel}
                  onChange={(e) => resetPage(setRombel)(e.target.value)}
                  className="input"
                >
                  <option value="">Semua Rombel</option>
                  {rombelOptions.map((item) => (
                    <option key={item} value={item}>
                      Rombel {item}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="filter-jk" className="label">
                  Jenis Kelamin
                </label>
                <Select
                  id="filter-jk"
                  value={jenisKelamin}
                  onChange={(e) => resetPage(setJenisKelamin)(e.target.value)}
                  className="input"
                >
                  <option value="">Semua</option>
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
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
          onSort={handleSort}
          emptyState={
            <EmptyState
              icon={BookOpen}
              title={search || activeFilters ? 'Siswa Tidak Ditemukan' : 'Belum Ada Data Siswa'}
              description={
                search || activeFilters
                  ? 'Coba ubah kata kunci pencarian atau reset filter yang aktif.'
                  : 'Mulai dengan mengimpor file Excel Buku Induk atau menambah siswa secara manual.'
              }
              action={
                search || activeFilters ? (
                  <button type="button" onClick={clearFilters} className="btn-secondary btn-sm">
                    Reset pencarian
                  </button>
                ) : (
                  can('student.create') && (
                    <Link to="/buku-induk/baru" className="btn-primary btn-sm">
                      <Plus size={15} />
                      Tambah Siswa
                    </Link>
                  )
                )
              }
            />
          }
          mobileRender={(row) => (
            <Link to={`/buku-induk/${row.id}`} className="block px-4 py-3.5 transition active:bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{row.nama_lengkap}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {row.no_induk} • NISN {row.nisn || '-'}
                  </p>
                </div>
                <GenderPill value={row.jenis_kelamin} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="stat-chip">Kelas {row.kelas}</span>
                <span className="stat-chip">Rombel {row.rombel || '-'}</span>
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
