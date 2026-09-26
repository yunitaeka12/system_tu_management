import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BadgeCheck,
  BookUser,
  CreditCard,
  Home,
  IdCard,
  Pencil,
  Ruler,
  Trash2,
  Users,
  UserSquare2,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DetailItem, { DetailGrid } from '../components/DetailItem';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { useStudent } from '../hooks/useStudents';
import { useStudentPayment } from '../hooks/usePayments';
import { deleteStudent } from '../services/studentService';
import { useAuth } from '../context/AuthContext';
import { confirmDialog, toast } from '../lib/toast';
import { formatCurrency, formatPercent } from '../utils/currency';
import { cn, initials } from '../utils/helpers';

const TABS = [
  { key: 'identitas', label: 'Identitas Siswa', icon: IdCard },
  { key: 'keluarga', label: 'Data Keluarga', icon: Users },
  { key: 'ayah', label: 'Data Ayah', icon: UserSquare2 },
  { key: 'ibu', label: 'Data Ibu', icon: UserSquare2 },
  { key: 'alamat', label: 'Alamat Orang Tua', icon: Home },
  { key: 'wali', label: 'Data Wali', icon: BookUser },
  { key: 'fisik', label: 'Data Fisik', icon: Ruler },
];

function SectionCard({ title, children }) {
  return (
    <div className="card card-pad">
      <h3 className="mb-5 text-sm font-semibold text-slate-800">{title}</h3>
      {children}
    </div>
  );
}

function PaymentSummaryCard({ summary }) {
  if (!summary) return null;
  const { annualFee, totalPaid, remaining, status, progress, monthlyFee } = summary;

  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Ringkasan Pembayaran</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Tagihan bulanan {formatCurrency(monthlyFee)}
          </p>
        </div>
        <PaymentStatusBadge status={status} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { label: 'Total Tagihan', value: annualFee, tone: 'text-slate-800' },
          { label: 'Sudah Dibayar', value: totalPaid, tone: 'text-school-700' },
          { label: 'Sisa Tagihan', value: remaining, tone: 'text-red-600' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {item.label}
            </p>
            <p className={cn('mt-1 truncate text-sm font-bold', item.tone)}>
              {formatCurrency(item.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-500 to-school-500 transition-all duration-500"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Terbayar {formatPercent(progress, 0)} dari total tagihan tahunan.
      </p>

      <Link to={`/pembayaran/${summary.student.id}`} className="btn-primary btn-sm mt-4 w-full">
        <CreditCard size={15} />
        Buka Detail Pembayaran
      </Link>
    </div>
  );
}

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [tab, setTab] = useState('identitas');

  const student = useStudent(id);
  const summary = useStudentPayment(id);

  if (!student) {
    return (
      <div className="card">
        <EmptyState
          icon={Users}
          title="Data Siswa Tidak Ditemukan"
          description="Siswa mungkin sudah dihapus atau tautan tidak valid."
          action={
            <Link to="/buku-induk" className="btn-primary btn-sm">
              <ArrowLeft size={15} />
              Kembali ke Buku Induk
            </Link>
          }
        />
      </div>
    );
  }

  const handleDelete = async () => {
    const confirmed = await confirmDialog({
      title: 'Hapus data siswa?',
      text: `${student.nama_lengkap} (${student.no_induk}) akan dihapus beserta seluruh riwayat pembayarannya.`,
      confirmText: 'Ya, hapus',
    });
    if (!confirmed) return;
    const result = deleteStudent(student.id);
    if (result.ok) {
      toast.success(`Data ${student.nama_lengkap} berhasil dihapus.`);
      navigate('/buku-induk', { replace: true });
    } else {
      toast.error(result.error || 'Gagal menghapus data.');
    }
  };

  const activeTab = TABS.find((item) => item.key === tab) ?? TABS[0];

  return (
    <div>
      <PageHeader
        title="Detail Buku Induk"
        subtitle="Informasi lengkap siswa sesuai struktur Excel Buku Induk."
        actions={
          <>
            <Link to="/buku-induk" className="btn-secondary btn-sm">
              <ArrowLeft size={15} />
              Kembali
            </Link>
            {can('student.update') && (
              <Link to={`/buku-induk/${student.id}/edit`} className="btn-primary btn-sm">
                <Pencil size={15} />
                Edit Data
              </Link>
            )}
            {can('student.delete') && (
              <button type="button" onClick={handleDelete} className="btn-danger btn-sm">
                <Trash2 size={15} />
                Hapus
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Left: profile + payments */}
        <div className="space-y-5">
          <div className="card card-pad">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 text-lg font-bold text-white">
                {initials(student.nama_lengkap)}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-slate-900">
                  {student.nama_lengkap}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {student.nama_panggilan ? `"${student.nama_panggilan}" • ` : ''}
                  {student.jenis_kelamin || '-'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="stat-chip">
                    <BadgeCheck size={13} className="text-primary-500" />
                    No Induk {student.no_induk}
                  </span>
                  <span className="stat-chip">Kelas {student.kelas}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <DetailItem label="NISN" value={student.nisn} mono />
              <DetailItem label="Rombel" value={student.rombel} />
              <DetailItem label="NIK" value={student.nik} mono />
              <DetailItem label="No KK" value={student.no_kk} mono />
            </div>
          </div>

          <PaymentSummaryCard summary={summary} />
        </div>

        {/* Right: tabs */}
        <div className="xl:col-span-2">
          <div className="card overflow-hidden">
            {/* flex-wrap: label tab panjang (mis. "Alamat Orang Tua") tidak lagi terpotong */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-200 p-2">
              {TABS.map((item) => {
                const Icon = item.icon;
                const isActive = tab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="p-5"
            >
              {tab === 'identitas' && (
                <DetailGrid>
                  <DetailItem label="No" value={student.no_urut} />
                  <DetailItem label="Rombel" value={student.rombel} />
                  <DetailItem label="Kelas" value={student.kelas} />
                  <DetailItem label="No Induk" value={student.no_induk} mono />
                  <DetailItem label="NISN" value={student.nisn} mono />
                  <DetailItem label="Nama Lengkap" value={student.nama_lengkap} />
                  <DetailItem label="Nama Panggilan" value={student.nama_panggilan} />
                  <DetailItem label="No KK" value={student.no_kk} mono />
                  <DetailItem label="NIK" value={student.nik} mono />
                  <DetailItem label="No Regis Akta" value={student.no_regis_akta} mono />
                  <DetailItem label="Jenis Kelamin" value={student.jenis_kelamin} />
                  <DetailItem label="Agama" value={student.agama} />
                  <DetailItem label="Kewarganegaraan" value={student.kewarganegaraan} />
                  <DetailItem
                    label="Tempat / Tanggal Lahir"
                    value={student.tempat_tanggal_lahir}
                    className="sm:col-span-2"
                  />
                  <DetailItem label="Anak Ke" value={student.anak_ke} />
                  <DetailItem label="Jumlah Saudara" value={student.jumlah_saudara} />
                  <DetailItem label="Bahasa Sehari-hari" value={student.bahasa_sehari_hari} />
                  <DetailItem label="Alamat" value={student.alamat} className="sm:col-span-2 lg:col-span-3" />
                  <DetailItem label="Nomor Telp/HP" value={student.nomor_hp} />
                  <DetailItem label="Tinggal Bersama" value={student.tinggal_bersama} />
                  <DetailItem label="Jarak ke Sekolah" value={student.jarak_tempat_tinggal} />
                  <DetailItem label="Waktu Tempuh" value={student.waktu_tempuh} />
                  <DetailItem
                    label="Pendidikan Sebelumnya"
                    value={student.pendidikan_sebelumnya}
                    className="sm:col-span-2"
                  />
                  <DetailItem label="Keterangan" value={student.keterangan} />
                </DetailGrid>
              )}

              {tab === 'keluarga' && (
                <DetailGrid>
                  <DetailItem label="Anak Ke" value={student.anak_ke} />
                  <DetailItem label="Jumlah Saudara" value={student.jumlah_saudara} />
                  <DetailItem label="Bahasa Sehari-hari" value={student.bahasa_sehari_hari} />
                  <DetailItem label="Tinggal Bersama" value={student.tinggal_bersama} />
                  <DetailItem label="Jarak ke Sekolah" value={student.jarak_tempat_tinggal} />
                  <DetailItem label="Waktu Tempuh" value={student.waktu_tempuh} />
                  <DetailItem label="Nama Ayah" value={student.father?.nama} />
                  <DetailItem label="Nama Ibu" value={student.mother?.nama} />
                  <DetailItem label="Nama Wali" value={student.guardian?.nama} />
                </DetailGrid>
              )}

              {tab === 'ayah' && (
                <DetailGrid>
                  <DetailItem label="Nama Ayah" value={student.father?.nama} />
                  <DetailItem label="Tahun Lahir" value={student.father?.tahun_lahir} />
                  <DetailItem label="NIK" value={student.father?.nik} mono />
                  <DetailItem label="Agama" value={student.father?.agama} />
                  <DetailItem label="Pendidikan" value={student.father?.pendidikan} />
                  <DetailItem label="Pekerjaan" value={student.father?.pekerjaan} />
                  <DetailItem label="Penghasilan" value={student.father?.penghasilan} className="sm:col-span-2" />
                </DetailGrid>
              )}

              {tab === 'ibu' && (
                <DetailGrid>
                  <DetailItem label="Nama Ibu" value={student.mother?.nama} />
                  <DetailItem label="Tahun Lahir" value={student.mother?.tahun_lahir} />
                  <DetailItem label="NIK" value={student.mother?.nik} mono />
                  <DetailItem label="Agama" value={student.mother?.agama} />
                  <DetailItem label="Pendidikan" value={student.mother?.pendidikan} />
                  <DetailItem label="Pekerjaan" value={student.mother?.pekerjaan} />
                  <DetailItem label="Penghasilan" value={student.mother?.penghasilan} className="sm:col-span-2" />
                </DetailGrid>
              )}

              {tab === 'alamat' && (
                <DetailGrid>
                  <DetailItem label="Jalan" value={student.address?.jalan} className="sm:col-span-2" />
                  <DetailItem label="Nama Dusun" value={student.address?.nama_dusun} />
                  <DetailItem label="RT/RW" value={student.address?.rt_rw} />
                  <DetailItem label="Kelurahan/Desa" value={student.address?.kelurahan} />
                  <DetailItem label="Kecamatan" value={student.address?.kecamatan} />
                  <DetailItem label="Kota/Kabupaten" value={student.address?.kota_kabupaten} />
                  <DetailItem label="Provinsi" value={student.address?.provinsi} />
                  <DetailItem label="Nomor Telp/HP" value={student.address?.nomor_hp} />
                </DetailGrid>
              )}

              {tab === 'wali' && (
                <DetailGrid>
                  <DetailItem label="Nama Wali" value={student.guardian?.nama} />
                  <DetailItem label="Tahun Lahir" value={student.guardian?.tahun_lahir} />
                  <DetailItem label="Agama" value={student.guardian?.agama} />
                  <DetailItem label="Pendidikan" value={student.guardian?.pendidikan} />
                  <DetailItem label="Pekerjaan" value={student.guardian?.pekerjaan} />
                  <DetailItem label="Hubungan Keluarga" value={student.guardian?.hubungan_keluarga} />
                  <DetailItem label="Alamat" value={student.guardian?.alamat} className="sm:col-span-2 lg:col-span-3" />
                </DetailGrid>
              )}

              {tab === 'fisik' && (
                <DetailGrid columns={2}>
                  <DetailItem
                    label="Tinggi Badan"
                    value={student.tinggi_badan ? `${student.tinggi_badan} cm` : null}
                  />
                  <DetailItem
                    label="Berat Badan"
                    value={student.berat_badan ? `${student.berat_badan} kg` : null}
                  />
                  <DetailItem
                    label="Lingkar Kepala"
                    value={student.lingkar_kepala ? `${student.lingkar_kepala} cm` : null}
                  />
                  <DetailItem label="Keterangan" value={student.keterangan} />
                </DetailGrid>
              )}
            </motion.div>
          </div>

          <p className="mt-3 px-1 text-xs text-slate-400">
            Bagian aktif: <span className="font-medium text-slate-500">{activeTab.label}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
