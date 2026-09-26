import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Award, BadgeCheck, Pencil, Plus, Trash2, UserMinus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import FormField from '../components/FormField';
import PaymentHistory from '../components/payment/PaymentHistory';
import EkskulPaymentForm from '../components/ekskul/EkskulPaymentForm';
import { useStudentEkskul } from '../hooks/useEkskul';
import {
  getEkskulOptions,
  addEkskulPayment,
  addEnrollment,
  deleteEkskulPayment,
  getEkskulFee,
  previewEkskulPayment,
  removeEnrollment,
  updateEkskulPayment,
  updateEnrollment,
} from '../services/ekskulService';
import { useAuth } from '../context/AuthContext';
import { confirmDialog, toast } from '../lib/toast';
import { formatCurrency } from '../utils/currency';
import { cn, initials } from '../utils/helpers';

function StatChip({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-800',
    green: 'text-school-700',
    amber: 'text-amber-700',
    primary: 'text-primary-700',
  };
  return (
    <div className="rounded-xl bg-slate-50 px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn('mt-1 truncate text-sm font-bold', tones[tone])}>{value}</p>
    </div>
  );
}

export default function EkskulDetail() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { can, session } = useAuth();
  const detail = useStudentEkskul(studentId);

  const [enrollmentModal, setEnrollmentModal] = useState(null); // { mode, enrollment? }
  const [selectedEkskul, setSelectedEkskul] = useState('');
  const [addPaymentFor, setAddPaymentFor] = useState(null);
  const [editing, setEditing] = useState(null); // { enrollment, payment }
  const [saving, setSaving] = useState(false);

  if (!detail) {
    return (
      <div className="card">
        <EmptyState
          icon={AlertTriangle}
          title="Data Siswa Tidak Ditemukan"
          description="Siswa tidak ditemukan pada Buku Induk."
          action={
            <Link to="/ekskul" className="btn-primary btn-sm">
              <ArrowLeft size={15} />
              Kembali ke Ekskul
            </Link>
          }
        />
      </div>
    );
  }

  const { student, enrollments } = detail;
  // Daftar ekskul mengikuti pengaturan terbaru (menu Pengaturan).
  const ekskulOptions = getEkskulOptions();

  /* ---------------- Pendaftaran ekskul ---------------- */
  const openAddEnrollment = () => {
    const available = ekskulOptions.find(
      (item) => !enrollments.some((row) => row.ekskul_nama === item.nama),
    );
    setSelectedEkskul(available?.nama ?? '');
    setEnrollmentModal({ mode: 'add' });
  };

  const handleSaveEnrollment = () => {
    if (enrollmentModal?.mode === 'edit') {
      const result = updateEnrollment(enrollmentModal.enrollment.id, {
        ekskul_nama: selectedEkskul,
        biaya_bulanan: getEkskulFee(selectedEkskul),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Data ekskul berhasil diperbarui.');
    } else {
      const result = addEnrollment(studentId, selectedEkskul);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${student.nama_lengkap} terdaftar di ekskul ${selectedEkskul}.`);
    }
    setEnrollmentModal(null);
  };

  const handleRemoveEnrollment = async (enrollment) => {
    const confirmed = await confirmDialog({
      title: `Keluarkan dari ekskul ${enrollment.ekskul_nama}?`,
      text: `${student.nama_lengkap} akan dikeluarkan dari ekskul ini beserta ${enrollment.transactionCount} transaksi pembayarannya.`,
      confirmText: 'Ya, keluarkan',
    });
    if (!confirmed) return;
    const result = removeEnrollment(enrollment.id);
    if (result.ok) toast.success('Data ekskul berhasil dihapus.');
    else toast.error(result.error);
  };

  /* ---------------- Pembayaran ekskul ---------------- */
  const handleAddPayment = async (values) => {
    const previewData = previewEkskulPayment({
      enrollmentId: addPaymentFor.id,
      bulan: values.bulan,
      nominal: values.nominal,
    });

    if (previewData?.duplicate?.hasDuplicate) {
      const proceed = await confirmDialog({
        title: `Pembayaran ${values.bulan} sudah tercatat`,
        text: `Total tercatat ${formatCurrency(
          previewData.duplicate.total,
        )} untuk ekskul ${addPaymentFor.ekskul_nama}. Tetap tambahkan pembayaran ini?`,
        confirmText: 'Tetap simpan',
      });
      if (!proceed) return;
    }

    if (previewData?.isOverpay) {
      const proceed = await confirmDialog({
        title: 'Nominal melebihi biaya bulanan',
        text: `Kelebihan ${formatCurrency(previewData.overpaid)} dari biaya bulanan ekskul. Lanjutkan?`,
        confirmText: 'Ya, simpan',
      });
      if (!proceed) return;
    }

    setSaving(true);
    const result = addEkskulPayment({
      enrollmentId: addPaymentFor.id,
      bulan: values.bulan,
      nominal: values.nominal,
      tanggalBayar: values.tanggalBayar,
      keterangan: values.keterangan,
      createdBy: session?.name || 'Tata Usaha',
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error || 'Gagal menyimpan pembayaran ekskul.');
      return;
    }
    toast.success('Pembayaran ekskul berhasil disimpan.');
    setAddPaymentFor(null);
  };

  const handleEditPayment = async (values) => {
    setSaving(true);
    const result = updateEkskulPayment(editing.payment.id, values);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error || 'Gagal memperbarui pembayaran.');
      return;
    }
    toast.success('Pembayaran ekskul berhasil diperbarui.');
    setEditing(null);
  };

  const handleDeletePayment = async (payment) => {
    const confirmed = await confirmDialog({
      title: 'Hapus transaksi pembayaran ekskul?',
      text: `Pembayaran ${payment.ekskul_nama} bulan ${payment.bulan} sebesar ${formatCurrency(
        payment.nominal_bayar,
      )} akan dihapus permanen.`,
      confirmText: 'Ya, hapus',
    });
    if (!confirmed) return;
    const result = deleteEkskulPayment(payment.id);
    if (result.ok) toast.success('Transaksi pembayaran ekskul berhasil dihapus.');
    else toast.error(result.error);
  };

  return (
    <div>
      <PageHeader
        title="Detail Ekskul Siswa"
        subtitle="Kelola ekskul yang diikuti beserta pembayaran bulanannya."
        actions={
          <>
            <Link to="/ekskul" className="btn-secondary btn-sm">
              <ArrowLeft size={15} />
              Kembali
            </Link>
            {can('student.update') && (
              <button type="button" onClick={openAddEnrollment} className="btn-primary btn-sm">
                <Plus size={15} />
                Tambah Ekskul
              </button>
            )}
          </>
        }
      />

      {/* Header siswa */}
      <div className="card card-pad mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 text-lg font-bold text-white">
              {initials(student.nama_lengkap)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold tracking-tight text-slate-900">
                {student.nama_lengkap}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                <span>
                  No Induk: <strong className="font-semibold text-slate-700">{student.no_induk}</strong>
                </span>
                <span>
                  NISN: <strong className="font-semibold text-slate-700">{student.nisn || '-'}</strong>
                </span>
                <span>
                  Kelas: <strong className="font-semibold text-slate-700">{student.kelas}</strong>
                </span>
              </div>
            </div>
          </div>
          <Link
            to={`/buku-induk/${student.id}`}
            className="btn-secondary btn-sm shrink-0 self-start sm:self-auto"
          >
            <BadgeCheck size={15} />
            Lihat Buku Induk
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
          <StatChip
            label="Ekskul Diikuti"
            value={`${enrollments.length} ekskul`}
            tone="primary"
          />
          <StatChip label="Biaya / Bulan" value={formatCurrency(detail.totalFee)} />
          <StatChip label="Total Dibayar" value={formatCurrency(detail.totalPaid)} tone="green" />
          <StatChip
            label="Kekurangan Bulan Ini"
            value={formatCurrency(
              enrollments.reduce((sum, item) => {
                const thisMonth = item.payments.filter(
                  (p) => p.bulan === new Date().toLocaleDateString('id-ID', { month: 'long' }),
                );
                const paid = thisMonth.reduce((s, p) => s + Number(p.nominal_bayar || 0), 0);
                return sum + Math.max(item.monthlyFee - paid, 0);
              }, 0),
            )}
            tone="amber"
          />
        </div>
      </div>

      {enrollments.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Award}
            title="Belum Mengikuti Ekskul"
            description="Tambahkan ekskul yang diikuti siswa untuk mulai mencatat pembayaran bulanannya."
            action={
              can('student.update') && (
                <button type="button" onClick={openAddEnrollment} className="btn-primary btn-sm">
                  <Plus size={15} />
                  Tambah Ekskul
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-5">
          {enrollments.map((enrollment) => (
            <div key={enrollment.id} className="space-y-4">
              {/* Kartu ekskul */}
              <div className="card card-pad">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600">
                        <Award size={17} />
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          {enrollment.ekskul_nama}
                        </h3>
                        <p className="text-xs text-slate-500">
                          Biaya bulanan {formatCurrency(enrollment.monthlyFee)}
                          {enrollment.tahun_ajaran ? ` • TA ${enrollment.tahun_ajaran}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {can('payment.create') && (
                      <button
                        type="button"
                        onClick={() => setAddPaymentFor(enrollment)}
                        className="btn-primary btn-sm"
                      >
                        <Plus size={15} />
                        Add Pembayaran Ekskul
                      </button>
                    )}
                    {can('student.update') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEkskul(enrollment.ekskul_nama);
                          setEnrollmentModal({ mode: 'edit', enrollment });
                        }}
                        className="btn-secondary btn-sm"
                        title="Ubah ekskul"
                      >
                        <Pencil size={15} />
                        Ubah
                      </button>
                    )}
                    {can('student.delete') && (
                      <button
                        type="button"
                        onClick={() => handleRemoveEnrollment(enrollment)}
                        className="btn-danger btn-sm"
                        title="Hapus ekskul"
                      >
                        <UserMinus size={15} />
                        Hapus
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
                  <StatChip label="Biaya / Bulan" value={formatCurrency(enrollment.monthlyFee)} />
                  <StatChip
                    label="Total Dibayar"
                    value={formatCurrency(enrollment.totalPaid)}
                    tone="green"
                  />
                  <StatChip label="Bulan Terbayar" value={`${enrollment.paidMonths.length} bulan`} />
                  <StatChip
                    label="Transaksi"
                    value={`${enrollment.transactionCount} transaksi`}
                  />
                </div>
              </div>

              {/* Riwayat + peta warna bulanan */}
              <PaymentHistory
                payments={enrollment.payments}
                monthlyFee={enrollment.monthlyFee}
                title={`Riwayat Pembayaran ${enrollment.ekskul_nama}`}
                emptyTitle={`Belum Ada Pembayaran ${enrollment.ekskul_nama}`}
                emptyDescription="Tambahkan pembayaran ekskul untuk menampilkan peta pembayaran bulanan."
                onEdit={
                  can('payment.update')
                    ? (payment) => setEditing({ enrollment, payment })
                    : () => {}
                }
                onDelete={can('payment.delete') ? handleDeletePayment : () => {}}
              />
            </div>
          ))}
        </div>
      )}

      {/* Modal tambah/ubah ekskul */}
      <Modal
        open={Boolean(enrollmentModal)}
        onClose={() => setEnrollmentModal(null)}
        title={enrollmentModal?.mode === 'edit' ? 'Ubah Ekskul' : 'Tambah Ekskul'}
        description={`Pilih ekskul untuk ${student.nama_lengkap}`}
        size="sm"
      >
        <div className="space-y-4">
          <FormField label="Ekskul" htmlFor="ekskul-pilihan" required>
            <select
              id="ekskul-pilihan"
              value={selectedEkskul}
              onChange={(e) => setSelectedEkskul(e.target.value)}
              className="input"
            >
              <option value="">Pilih Ekskul</option>
              {ekskulOptions.map((item) => (
                <option
                  key={item.nama}
                  value={item.nama}
                  disabled={
                    enrollmentModal?.mode === 'add' &&
                    enrollments.some((row) => row.ekskul_nama === item.nama)
                  }
                >
                  {item.nama} — {formatCurrency(item.biaya)}/bulan
                </option>
              ))}
            </select>
          </FormField>

          {selectedEkskul && (
            <p className="rounded-xl border border-primary-100 bg-primary-50/60 px-3.5 py-3 text-xs text-primary-800">
              Biaya bulanan <strong>{formatCurrency(getEkskulFee(selectedEkskul))}</strong>. Ekskul
              dibayar per periode bulan (tidak ada total tahunan).
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setEnrollmentModal(null)} className="btn-secondary">
              Batalkan
            </button>
            <button
              type="button"
              onClick={handleSaveEnrollment}
              disabled={!selectedEkskul}
              className="btn-primary"
            >
              {enrollmentModal?.mode === 'edit' ? 'Simpan Perubahan' : 'Tambahkan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal tambah pembayaran */}
      <Modal
        open={Boolean(addPaymentFor)}
        onClose={() => setAddPaymentFor(null)}
        title="Add Pembayaran Ekskul"
        description={
          addPaymentFor
            ? `Pembayaran ekskul ${addPaymentFor.ekskul_nama} untuk ${student.nama_lengkap}`
            : ''
        }
        size="lg"
      >
        {addPaymentFor && (
          <EkskulPaymentForm
            student={student}
            enrollment={addPaymentFor}
            preview={({ bulan, nominal }) =>
              previewEkskulPayment({ enrollmentId: addPaymentFor.id, bulan, nominal })
            }
            onSubmit={handleAddPayment}
            onCancel={() => setAddPaymentFor(null)}
            submitting={saving}
            submitLabel="Simpan Pembayaran Ekskul"
          />
        )}
      </Modal>

      {/* Modal edit pembayaran */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit Pembayaran Ekskul"
        description={
          editing
            ? `Perbarui transaksi ${editing.enrollment.ekskul_nama} bulan ${editing.payment.bulan}`
            : ''
        }
        size="lg"
      >
        {editing && (
          <EkskulPaymentForm
            student={student}
            enrollment={editing.enrollment}
            initialValues={editing.payment}
            excludePaymentId={editing.payment.id}
            preview={({ bulan, nominal }) =>
              previewEkskulPayment({
                enrollmentId: editing.enrollment.id,
                bulan,
                nominal,
                excludePaymentId: editing.payment.id,
              })
            }
            onSubmit={handleEditPayment}
            onCancel={() => setEditing(null)}
            submitting={saving}
            submitLabel="Perbarui Pembayaran"
          />
        )}
      </Modal>

      {session && (
        <p className="mt-4 text-xs text-slate-400">
          Dicatat oleh {session.name} • {session.role}
        </p>
      )}
    </div>
  );
}
