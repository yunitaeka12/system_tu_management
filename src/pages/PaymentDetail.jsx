import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BadgeCheck, Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import PaymentSummary from '../components/payment/PaymentSummary';
import PaymentHistory from '../components/payment/PaymentHistory';
import PaymentForm from '../components/payment/PaymentForm';
import EkskulPaymentForm from '../components/ekskul/EkskulPaymentForm';
import { useStudentPayment } from '../hooks/usePayments';
import { useStudentEkskul } from '../hooks/useEkskul';
import { deletePayment, previewPayment, updatePayment } from '../services/paymentService';
import {
  deleteEkskulPayment,
  previewEkskulPayment,
  updateEkskulPayment,
} from '../services/ekskulService';
import { useAuth } from '../context/AuthContext';
import { confirmDialog, toast } from '../lib/toast';
import { formatCurrency } from '../utils/currency';
import { initials } from '../utils/helpers';

export default function PaymentDetail() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { can, session } = useAuth();
  const summary = useStudentPayment(studentId);
  const ekskulDetail = useStudentEkskul(studentId);

  const [editing, setEditing] = useState(null);
  const [editingEkskul, setEditingEkskul] = useState(null); // { enrollment, payment }
  const [saving, setSaving] = useState(false);

  if (!summary) {
    return (
      <div className="card">
        <EmptyState
          icon={AlertTriangle}
          title="Data Siswa Tidak Ditemukan"
          description="Siswa tidak ditemukan pada Buku Induk."
          action={
            <Link to="/pembayaran" className="btn-primary btn-sm">
              <ArrowLeft size={15} />
              Kembali ke Pembayaran
            </Link>
          }
        />
      </div>
    );
  }

  const { student } = summary;

  const handleDelete = async (payment) => {
    const confirmed = await confirmDialog({
      title: 'Hapus transaksi pembayaran?',
      text: `Pembayaran ${payment.bulan} sebesar ${formatCurrency(
        payment.nominal_bayar,
      )} akan dihapus permanen dan sisa tagihan dihitung ulang.`,
      confirmText: 'Ya, hapus',
    });
    if (!confirmed) return;

    const result = deletePayment(payment.id);
    if (result.ok) toast.success('Transaksi pembayaran berhasil dihapus.');
    else toast.error(result.error || 'Gagal menghapus transaksi.');
  };

  const handleEditSubmit = async (values) => {
    const previewData = previewPayment({
      studentId,
      bulan: values.bulan,
      nominal: values.nominal,
      excludePaymentId: editing.id,
    });

    if (previewData?.duplicate?.hasDuplicate) {
      const proceed = await confirmDialog({
        title: `Pembayaran bulan ${values.bulan} sudah tercatat`,
        text: 'Masih ada transaksi lain pada bulan yang sama. Tetap simpan perubahan ini?',
        confirmText: 'Tetap simpan',
        cancelText: 'Batalkan',
      });
      if (!proceed) return;
    }

    if (previewData?.isOverpay) {
      const proceed = await confirmDialog({
        title: 'Pembayaran melebihi total tagihan',
        text: `Nominal melebihi total tagihan sebesar ${formatCurrency(
          previewData.overpaid,
        )}. Lanjutkan?`,
        confirmText: 'Ya, simpan',
        icon: 'warning',
      });
      if (!proceed) return;
    }

    setSaving(true);
    const result = updatePayment(editing.id, values);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error || 'Gagal memperbarui transaksi.');
      return;
    }
    toast.success('Transaksi pembayaran berhasil diperbarui.');
    setEditing(null);
  };

  const handleEditEkskulSubmit = async (values) => {
    setSaving(true);
    const result = updateEkskulPayment(editingEkskul.payment.id, values);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error || 'Gagal memperbarui pembayaran ekskul.');
      return;
    }
    toast.success('Pembayaran ekskul berhasil diperbarui.');
    setEditingEkskul(null);
  };

  const handleDeleteEkskul = async (payment) => {
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
    else toast.error(result.error || 'Gagal menghapus transaksi ekskul.');
  };

  const enrollments = ekskulDetail?.enrollments ?? [];

  return (
    <div>
      <PageHeader
        title="Detail Pembayaran Siswa"
        subtitle="Riwayat dan perhitungan tagihan diambil otomatis dari Buku Induk."
        actions={
          <>
            <Link to="/pembayaran" className="btn-secondary btn-sm">
              <ArrowLeft size={15} />
              Kembali
            </Link>
            {can('payment.create') && (
              <Link
                to={`/pembayaran/${studentId}/tambah`}
                className="btn-primary btn-sm"
              >
                <Plus size={15} />
                Add Pembayaran
              </Link>
            )}
          </>
        }
      />

      {/* Header siswa */}
      <div className="card card-pad mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-primary-600 text-lg font-bold text-white">
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
      </div>

      <PaymentSummary summary={summary} monthlyFee={summary.monthlyFee} className="mb-5" />

      {/* Info ekskul siswa — pengelolaan pendaftaran ada di Buku Induk */}
      {enrollments.length > 0 && (
        <div className="card card-pad mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Ekskul Saat Ini</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Total dibayar ekskul {formatCurrency(ekskulDetail.totalPaid)}
              </p>
            </div>
            <Link to={`/buku-induk/${student.id}`} className="btn-secondary btn-sm">
              Kelola di Buku Induk
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {enrollments.map((enrollment) => (
              <span
                key={enrollment.id}
                className="badge bg-primary-50 text-primary-700 ring-1 ring-primary-100"
              >
                {enrollment.ekskul_nama} • {formatCurrency(enrollment.monthlyFee)}/bln
              </span>
            ))}
          </div>
        </div>
      )}

      <PaymentHistory
        payments={summary.payments}
        studentId={studentId}
        monthlyFee={summary.monthlyFee}
        enrollments={enrollments}
        onEdit={can('payment.update') ? setEditing : () => {}}
        onDelete={can('payment.delete') ? handleDelete : () => {}}
        onEditEkskul={can('payment.update') ? setEditingEkskul : () => {}}
        onDeleteEkskul={can('payment.delete') ? handleDeleteEkskul : () => {}}
      />

      {/* Modal edit */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit Pembayaran"
        description={
          editing ? `Perbarui transaksi ${editing.bulan} untuk ${student.nama_lengkap}` : ''
        }
        size="lg"
      >
        {editing && (
          <PaymentForm
            student={student}
            initialValues={editing}
            payments={summary.payments}
            enrollments={enrollments}
            excludePaymentId={editing.id}
            preview={({ bulan, nominal }) =>
              previewPayment({ studentId, bulan, nominal, excludePaymentId: editing.id })
            }
            onSubmit={handleEditSubmit}
            onCancel={() => setEditing(null)}
            submitting={saving}
            submitLabel="Perbarui Pembayaran"
          />
        )}
      </Modal>

      {/* Modal edit pembayaran ekskul */}
      <Modal
        open={Boolean(editingEkskul)}
        onClose={() => setEditingEkskul(null)}
        title="Edit Pembayaran Ekskul"
        description={
          editingEkskul
            ? `Perbarui transaksi ${editingEkskul.enrollment.ekskul_nama} bulan ${editingEkskul.payment.bulan}`
            : ''
        }
        size="lg"
      >
        {editingEkskul && (
          <EkskulPaymentForm
            student={student}
            enrollment={editingEkskul.enrollment}
            initialValues={editingEkskul.payment}
            excludePaymentId={editingEkskul.payment.id}
            preview={({ bulan, nominal }) =>
              previewEkskulPayment({
                enrollmentId: editingEkskul.enrollment.id,
                bulan,
                nominal,
                excludePaymentId: editingEkskul.payment.id,
              })
            }
            onSubmit={handleEditEkskulSubmit}
            onCancel={() => setEditingEkskul(null)}
            submitting={saving}
            submitLabel="Perbarui Pembayaran"
          />
        )}
      </Modal>

      {can('payment.create') && (
        <button
          type="button"
          onClick={() => navigate(`/pembayaran/${studentId}/tambah`)}
          className="btn-primary fixed bottom-6 right-6 z-30 shadow-dropdown lg:hidden"
        >
          <Plus size={17} />
          Add Pembayaran
        </button>
      )}

      {/* Petugas audit */}
      {session && (
        <p className="mt-4 text-xs text-slate-400">
          Dicatat oleh {session.name} • {session.role}
        </p>
      )}
    </div>
  );
}
