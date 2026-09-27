import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import PaymentSummary from '../components/payment/PaymentSummary';
import PaymentHistory from '../components/payment/PaymentHistory';
import PaymentForm from '../components/payment/PaymentForm';
import EkskulPaymentForm from '../components/ekskul/EkskulPaymentForm';
import AdjustmentForm from '../components/payment/AdjustmentForm';
import OtherPaymentForm from '../components/payment/OtherPaymentForm';
import { useStudentPayment } from '../hooks/usePayments';
import { useStudentEkskul } from '../hooks/useEkskul';
import { deletePayment, previewPayment, updatePayment } from '../services/paymentService';
import {
  deleteEkskulPayment,
  previewEkskulPayment,
  updateEkskulPayment,
} from '../services/ekskulService';
import {
  addAdjustment,
  adjustedMonths as adjustedMonthsFor,
  adjustmentPeriod,
  deleteAdjustment,
  monthsOf,
  updateAdjustment,
} from '../services/adjustmentService';
import {
  filterByPeriod,
  isOtherPayment,
  listStudentPeriods,
  periodFromStart,
  periodStartOf,
} from '../utils/paymentCalculator';
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
  const [editingLain, setEditingLain] = useState(null); // pembayaran lain-lain
  const [editingEkskul, setEditingEkskul] = useState(null); // { enrollment, payment }
  const [adjustmentModal, setAdjustmentModal] = useState(null); // { mode, row? }
  const [saving, setSaving] = useState(false);
  // Periode tahun ajaran yang sedang dilihat pada peta/riwayat (tahun mulai).
  // Kartu ringkasan selalu memakai periode tagihan berjalan.
  const [periodStart, setPeriodStart] = useState(null);

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
      periodStart: periodStartOf(values.bulan, values.tahun) ?? summary.period?.start,
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

  /** Edit transaksi: pembayaran lain-lain punya form sendiri. */
  const handleEditRequest = (payment) => {
    if (isOtherPayment(payment)) setEditingLain(payment);
    else setEditing(payment);
  };

  const handleEditLainSubmit = async (values) => {
    setSaving(true);
    const result = updatePayment(editingLain.id, values);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error || 'Gagal memperbarui pembayaran lain.');
      return;
    }
    toast.success('Pembayaran lain berhasil diperbarui.');
    setEditingLain(null);
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
  const adjustments = summary.adjustments ?? [];
  const period = summary.period ?? null;
  // Total adjustment seluruh periode (kartu Adjustement menampilkan semua baris).
  const adjustmentTotalAll = adjustments.reduce(
    (sum, row) => sum + (Number(row.nominal) || 0),
    0,
  );
  // Pilihan periode untuk form Adjustment: sejak periode No Induk sampai
  // periode yang punya transaksi.
  const periodOptions = listStudentPeriods(student.no_induk, [
    ...summary.payments,
    ...adjustments,
    ...enrollments.flatMap((enrollment) => enrollment.payments || []),
  ]);
  // Periode milik transaksi yang sedang diedit (bisa berbeda dari periode berjalan).
  const editingPeriodStart = editing
    ? periodStartOf(editing.bulan, editing.tahun) ?? period?.start
    : period?.start;

  const handleAdjustmentSubmit = async (values) => {
    setSaving(true);
    const result =
      adjustmentModal?.mode === 'edit'
        ? updateAdjustment(adjustmentModal.row.id, values)
        : addAdjustment({ ...values, studentId, createdBy: session?.name });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error || 'Gagal menyimpan adjustment.');
      return;
    }
    toast.success(
      adjustmentModal?.mode === 'edit'
        ? 'Adjustment berhasil diperbarui.'
        : 'Adjustment disimpan — bulan yang dicentang kini lunas di peta bulanan.',
    );
    setAdjustmentModal(null);
  };

  const handleDeleteAdjustment = async (row) => {
    const confirmed = await confirmDialog({
      title: 'Hapus adjustment?',
      text: `Adjustment sebesar ${formatCurrency(
        row.nominal,
      )} akan dihapus. Sisa tagihan bertambah kembali dan bulan yang tadi hijau kembali seperti semula.`,
      confirmText: 'Ya, hapus',
    });
    if (!confirmed) return;

    const result = deleteAdjustment(row.id);
    if (result.ok) toast.success('Adjustment berhasil dihapus.');
    else toast.error(result.error || 'Gagal menghapus adjustment.');
  };

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
            {can('payment.update') && (
              <button
                type="button"
                onClick={() => setAdjustmentModal({ mode: 'add' })}
                className="btn-secondary btn-sm"
                title="Catat pembayaran yang sudah tercatat di pembukuan sebelumnya"
              >
                <SlidersHorizontal size={15} />
                Adjustment
              </button>
            )}
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

      {/* Tagihan per periode tahun ajaran: mana yang sudah lunas / masih tunggakan */}
      {summary.periodDetails?.length > 0 && (
        <div className="card card-pad mb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Tagihan per Periode</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {summary.unpaidMonthCount > 0
                  ? `Sisa ${formatCurrency(summary.remaining)} dari ${summary.unpaidMonthCount} bulan yang belum lunas.`
                  : 'Seluruh periode sudah lunas.'}
              </p>
            </div>
            <span
              className={
                summary.remaining > 0
                  ? 'badge bg-red-50 text-red-700 ring-1 ring-red-100'
                  : 'badge bg-school-50 text-school-700 ring-1 ring-school-100'
              }
            >
              {summary.remaining > 0 ? 'Belum Lunas' : 'Lunas'}
            </span>
          </div>

          <ul className="mt-3 divide-y divide-slate-100">
            {summary.periodDetails.map((item) => (
              <li
                key={item.period.start}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-xs first:pt-0 last:pb-0"
              >
                <span className="text-slate-600">Periode {item.period.display}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-500">
                    Dibayar {formatCurrency(item.paid)} / {formatCurrency(item.billed)}
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
        </div>
      )}

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

      {/* Adjustment: pembayaran yang sudah tercatat di pembukuan sebelumnya */}
      {adjustments.length > 0 && (
        <div className="card card-pad mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Adjustment Tagihan</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Pembayaran yang sudah dibayar &amp; tercatat di pembukuan sebelumnya • total{' '}
                {formatCurrency(adjustmentTotalAll)}
              </p>
            </div>
            {can('payment.update') && (
              <button
                type="button"
                onClick={() => setAdjustmentModal({ mode: 'add' })}
                className="btn-secondary btn-sm"
              >
                <Plus size={15} />
                Tambah
              </button>
            )}
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {adjustments.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">
                    {formatCurrency(row.nominal)}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      Periode {periodFromStart(adjustmentPeriod(row))?.display}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Bulan lunas: {(monthsOf(row).join(', ') || '-')}
                  </p>
                  {row.keterangan && (
                    <p className="mt-1 text-xs italic text-slate-600">“{row.keterangan}”</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {can('payment.update') && (
                    <button
                      type="button"
                      onClick={() => setAdjustmentModal({ mode: 'edit', row })}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-amber-50 hover:text-amber-600"
                      title="Ubah adjustment"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  {can('payment.delete') && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAdjustment(row)}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                      title="Hapus adjustment"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <PaymentHistory
        payments={summary.payments}
        noInduk={student.no_induk}
        periodStart={periodStart}
        onPeriodChange={setPeriodStart}
        monthlyFee={summary.monthlyFee}
        enrollments={enrollments}
        adjustments={adjustments}
        onEdit={can('payment.update') ? handleEditRequest : () => {}}
        onDelete={can('payment.delete') ? handleDelete : () => {}}
        onEditEkskul={can('payment.update') ? setEditingEkskul : () => {}}
        onDeleteEkskul={can('payment.delete') ? handleDeleteEkskul : () => {}}
        onEditAdjustment={can('payment.update') ? (row) => setAdjustmentModal({ mode: 'edit', row }) : () => {}}
        onDeleteAdjustment={can('payment.delete') ? handleDeleteAdjustment : () => {}}
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
            payments={filterByPeriod(summary.payments, editingPeriodStart)}
            enrollments={enrollments}
            adjustedMonths={adjustedMonthsFor(studentId, editingPeriodStart)}
            periodStart={editingPeriodStart}
            totalBilled={summary.feePerPeriod}
            excludePaymentId={editing.id}
            preview={({ bulan, nominal }) =>
              previewPayment({
                studentId,
                bulan,
                nominal,
                excludePaymentId: editing.id,
                periodStart: editingPeriodStart,
              })
            }
            onSubmit={handleEditSubmit}
            onCancel={() => setEditing(null)}
            submitting={saving}
            submitLabel="Perbarui Pembayaran"
          />
        )}
      </Modal>

      {/* Modal edit pembayaran lain-lain */}
      <Modal
        open={Boolean(editingLain)}
        onClose={() => setEditingLain(null)}
        title="Edit Pembayaran Lain"
        description={
          editingLain
            ? `Perbarui pembayaran lain bulan ${editingLain.bulan} untuk ${student.nama_lengkap}`
            : ''
        }
        size="lg"
      >
        {editingLain && (
          <OtherPaymentForm
            student={student}
            initialValues={editingLain}
            onSubmit={handleEditLainSubmit}
            onCancel={() => setEditingLain(null)}
            submitting={saving}
            submitLabel="Perbarui Pembayaran Lain"
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
                periodStart:
                  periodStartOf(editingEkskul.payment.bulan, editingEkskul.payment.tahun) ??
                  period?.start,
              })
            }
            onSubmit={handleEditEkskulSubmit}
            onCancel={() => setEditingEkskul(null)}
            submitting={saving}
            submitLabel="Perbarui Pembayaran"
          />
        )}
      </Modal>

      {/* Modal adjustment */}
      <Modal
        open={Boolean(adjustmentModal)}
        onClose={() => setAdjustmentModal(null)}
        title={adjustmentModal?.mode === 'edit' ? 'Edit Adjustment' : 'Adjustment Tagihan'}
        description={
          adjustmentModal?.mode === 'edit'
            ? `Perbarui adjustment untuk ${student.nama_lengkap}`
            : `Catat pembayaran ${student.nama_lengkap} yang sudah tercatat di pembukuan sebelumnya`
        }
        size="lg"
      >
        {adjustmentModal && (
          <AdjustmentForm
            student={student}
            initialValues={adjustmentModal.row ?? null}
            monthlyFee={summary.monthlyFee}
            periodOptions={periodOptions}
            defaultPeriodStart={period?.start}
            onSubmit={handleAdjustmentSubmit}
            onCancel={() => setAdjustmentModal(null)}
            submitting={saving}
            submitLabel={adjustmentModal.mode === 'edit' ? 'Perbarui Adjustment' : 'Simpan Adjustment'}
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
