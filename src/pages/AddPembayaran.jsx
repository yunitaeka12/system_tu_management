import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CreditCard } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import PaymentForm from '../components/payment/PaymentForm';
import { useStudentPayment } from '../hooks/usePayments';
import { useStudentEkskul } from '../hooks/useEkskul';
import { useAuth } from '../context/AuthContext';
import { addPayment, previewPayment } from '../services/paymentService';
import { addEkskulPayment, ensureEnrollment, getEkskulOptions } from '../services/ekskulService';
import { adjustedMonths as adjustedMonthsFor } from '../services/adjustmentService';
import { currentPeriodStart, filterByPeriod } from '../utils/paymentCalculator';
import { confirmDialog, toast } from '../lib/toast';
import { formatCurrency } from '../utils/currency';
import { initials } from '../utils/helpers';

export default function AddPembayaran() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const summary = useStudentPayment(studentId);
  const ekskulDetail = useStudentEkskul(studentId);
  const [submitting, setSubmitting] = useState(false);

  if (!summary) {
    return (
      <div className="card">
        <EmptyState
          icon={CreditCard}
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
  const ekskulOptions = getEkskulOptions();
  // Pembayaran dicatat pada periode tahun ajaran berjalan.
  const periodStart = summary.period?.start ?? currentPeriodStart();

  const handleSubmit = async (values) => {
    const previewData = previewPayment({
      studentId,
      bulan: values.bulan,
      nominal: values.nominal,
      periodStart,
    });

    // Peringatan double payment.
    if (previewData?.duplicate?.hasDuplicate) {
      const total = previewData.duplicate.total;
      const existing = previewData.duplicate.payments
        .map((p) => `${p.bulan} • ${formatCurrency(p.nominal_bayar)}`)
        .join(', ');
      const proceed = await confirmDialog({
        title: `Pembayaran bulan ${values.bulan} sudah tercatat`,
        text: `Total tercatat: ${formatCurrency(total)} (${existing}). Apakah Anda ingin tetap menambah pembayaran untuk bulan ini?`,
        confirmText: 'Tetap simpan',
        cancelText: 'Batalkan',
      });
      if (!proceed) {
        toast.info('Pembayaran dibatalkan.', 'Tidak ada perubahan');
        return;
      }
    }

    // Peringatan kelebihan bayar.
    if (previewData?.isOverpay) {
      const proceed = await confirmDialog({
        title: 'Pembayaran melebihi total tagihan',
        text: `Nominal melebihi total tagihan sebesar ${formatCurrency(
          previewData.overpaid,
        )}. Lanjutkan menyimpan pembayaran ini?`,
        confirmText: 'Ya, simpan',
        cancelText: 'Batalkan',
        icon: 'warning',
      });
      if (!proceed) return;
    }

    // Peringatan bila bulan tsb sudah punya pembayaran ekskul.
    if (values.ekskulNama && Number(values.ekskulNominal) > 0) {
      const existing = (ekskulDetail?.enrollments ?? []).flatMap((enrollment) =>
        (enrollment.payments || [])
          .filter((payment) => payment.bulan === values.bulan)
          .map((payment) => ({
            nama: enrollment.ekskul_nama,
            nominal: Number(payment.nominal_bayar) || 0,
          })),
      );
      if (existing.length > 0) {
        const proceed = await confirmDialog({
          title: `Bulan ${values.bulan} sudah ada pembayaran ekskul`,
          text: `Tercatat: ${existing
            .map((item) => `${item.nama} ${formatCurrency(item.nominal)}`)
            .join(', ')}. Tetap tambahkan pembayaran ekskul ${values.ekskulNama}?`,
          confirmText: 'Tetap simpan',
          cancelText: 'Batalkan',
        });
        if (!proceed) {
          toast.info('Pembayaran dibatalkan.', 'Tidak ada perubahan');
          return;
        }
      }
    }

    setSubmitting(true);
    const result = addPayment({
      studentId,
      bulan: values.bulan,
      tahun: values.tahun,
      nominal: values.nominal,
      tanggalBayar: values.tanggalBayar,
      keterangan: values.keterangan,
      createdBy: session?.name || 'Tata Usaha',
    });

    if (!result.ok) {
      setSubmitting(false);
      toast.error(result.error || 'Gagal menyimpan pembayaran.');
      return;
    }

    // Pembayaran ekskul ikut dicatat bila ekskul dipilih (pendaftaran otomatis).
    if (values.ekskulNama && Number(values.ekskulNominal) > 0) {
      const ensured = ensureEnrollment(studentId, values.ekskulNama);
      if (!ensured.ok) {
        toast.error(ensured.error || 'Gagal mendaftarkan ekskul.');
      } else {
        const ekskulResult = addEkskulPayment({
          enrollmentId: ensured.enrollment.id,
          bulan: values.bulan,
          nominal: values.ekskulNominal,
          tanggalBayar: values.tanggalBayar,
          keterangan: `Pembayaran ekskul ${values.ekskulNama}`,
          createdBy: session?.name || 'Tata Usaha',
        });
        if (ekskulResult.ok) {
          toast.success(`Pembayaran ekskul ${values.ekskulNama} berhasil disimpan.`);
        } else {
          toast.error(ekskulResult.error || 'Gagal menyimpan pembayaran ekskul.');
        }
      }
    }

    // Pembayaran lain-lain (opsional) — dicatat sebagai transaksi terpisah dan
    // tidak mengurangi tagihan SPP.
    if (Number(values.lainNominal) > 0) {
      const lainResult = addPayment({
        studentId,
        bulan: values.bulan,
        tahun: values.tahun,
        nominal: values.lainNominal,
        jenis: 'lain',
        tanggalBayar: values.tanggalBayar,
        keterangan: values.lainKeterangan || 'Pembayaran lain-lain',
        createdBy: session?.name || 'Tata Usaha',
      });
      if (lainResult.ok) {
        toast.success(`Pembayaran lain ${formatCurrency(values.lainNominal)} berhasil disimpan.`);
      } else {
        toast.error(lainResult.error || 'Gagal menyimpan pembayaran lain.');
      }
    }

    setSubmitting(false);
    toast.success('Pembayaran berhasil disimpan.');
    navigate(`/pembayaran/${studentId}`, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Add Pembayaran"
        subtitle="Data siswa terisi otomatis — cukup pilih bulan dan masukkan nominal."
        actions={
          <Link to={`/pembayaran/${studentId}`} className="btn-secondary btn-sm">
            <ArrowLeft size={15} />
            Kembali
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="card card-pad">
            <PaymentForm
              student={student}
              payments={filterByPeriod(summary.billedPayments ?? [], periodStart)}
              enrollments={ekskulDetail?.enrollments ?? []}
              adjustedMonths={adjustedMonthsFor(studentId, periodStart)}
              periodStart={periodStart}
              totalBilled={summary.annualFee}
              showEkskul
              ekskulOptions={ekskulOptions}
              preview={({ bulan, nominal }) =>
                previewPayment({ studentId, bulan, nominal, periodStart })
              }
              onSubmit={handleSubmit}
              onCancel={() => navigate(`/pembayaran/${studentId}`)}
              submitting={submitting}
              submitLabel="Simpan Pembayaran"
            />
          </div>
        </div>

        <div className="space-y-5">
          <div className="card card-pad">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-sm font-bold text-primary-700">
                {initials(student.nama_lengkap)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{student.nama_lengkap}</p>
                <p className="text-xs text-slate-500">
                  {student.no_induk} • Kelas {student.kelas}
                </p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              {[
                { label: 'Total Tagihan', value: formatCurrency(summary.annualFee) },
                { label: 'Sudah Dibayar', value: formatCurrency(summary.totalPaid) },
                { label: 'Sisa Tagihan', value: formatCurrency(summary.remaining) },
                {
                  label: 'Terbayar',
                  value: `${summary.paidMonthCount ?? 0}/${summary.totalMonths ?? 12} bulan`,
                },
                { label: 'Periode Tagihan', value: summary.periodRange || '-' },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    {item.label}
                  </dt>
                  <dd className="mt-0.5 truncate text-sm font-semibold text-slate-800">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-2xl border border-primary-100 bg-primary-50/60 p-4">
            <p className="text-sm font-semibold text-primary-900">Tips penginputan</p>
            <ul className="mt-2 space-y-1.5 text-xs text-primary-800/80">
              <li>• Nominal otomatis terisi sesuai tarif bulanan angkatan siswa.</li>
              <li>• Bulan mengikuti periode tahun ajaran (Juli–Juni), bukan tahun kalender.</li>
              <li>• Ubah nominal bila sekolah menerima pembayaran sebagian.</li>
              <li>• Sistem otomatis menghitung total dibayar, sisa, dan status.</li>
              <li>• Bila bulan yang sama sudah ada, akan muncul peringatan.</li>
              <li>• Pilih ekskul (opsional) untuk sekaligus mencatat bayar ekskul.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
