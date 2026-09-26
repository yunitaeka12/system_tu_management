import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Database,
  Download,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  UserRound,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import FormField from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { changePassword, updateProfile, ROLE_LABELS } from '../services/authService';
import { clearPayments, exportDB, resetDB, DB_META } from '../lib/db';
import { confirmDialog, toast } from '../lib/toast';
import { getActiveAcademicYear } from '../services/paymentService';
import { useData } from '../context/DataContext';
import { formatNumber } from '../utils/currency';
import { formatDate, initials } from '../utils/helpers';

function Section({ icon: Icon, title, description, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="card overflow-hidden"
    >
      <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3.5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-white text-primary-600 ring-1 ring-slate-200">
          <Icon size={17} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </motion.section>
  );
}

export default function Profile() {
  const { session, refreshSession } = useAuth();

  const [profileForm, setProfileForm] = useState({
    name: session?.name ?? '',
    email: session?.email ?? '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirm: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const { version } = useData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeYear = useMemo(() => getActiveAcademicYear(), [version]);

  const handleProfileSubmit = (event) => {
    event.preventDefault();
    if (!profileForm.name.trim() || !profileForm.email.trim()) {
      toast.warning('Nama dan email wajib diisi.');
      return;
    }
    setSavingProfile(true);
    const updated = updateProfile(session.user_id, profileForm);
    setSavingProfile(false);
    if (!updated) {
      toast.error('Gagal memperbarui profil.');
      return;
    }
    refreshSession();
    toast.success('Profil berhasil diperbarui.');
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    if (passwordForm.next !== passwordForm.confirm) {
      toast.error('Konfirmasi password baru tidak cocok.');
      return;
    }
    if (passwordForm.next.length < 6) {
      toast.error('Password baru minimal 6 karakter.');
      return;
    }

    setSavingPassword(true);
    const result = await changePassword(session.user_id, passwordForm.current, passwordForm.next);
    setSavingPassword(false);

    if (!result.ok) {
      toast.error(result.error || 'Gagal mengubah password.');
      return;
    }
    setPasswordForm({ current: '', next: '', confirm: '' });
    refreshSession();
    toast.success('Password berhasil diubah.');
  };

  const handleBackup = () => {
    try {
      const data = exportDB();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-buku-induk-assalam-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Backup data berhasil diunduh.');
    } catch (error) {
      console.error(error);
      toast.error('Gagal membuat backup data.');
    }
  };

  const handleReset = async () => {
    const confirmed = await confirmDialog({
      title: 'Reset data Buku Induk?',
      text: 'Semua perubahan data siswa dan seluruh transaksi pembayaran akan dihapus, lalu data dikembalikan ke kondisi awal (hasil import Excel).',
      confirmText: 'Ya, reset sekarang',
    });
    if (!confirmed) return;
    resetDB();
    toast.success('Data berhasil direset ke kondisi awal.');
  };

  const handleResetPaymentsOnly = async () => {
    const confirmed = await confirmDialog({
      title: 'Hapus semua transaksi pembayaran?',
      text: 'Data Buku Induk tetap aman, hanya riwayat pembayaran yang dihapus.',
      confirmText: 'Ya, hapus transaksi',
    });
    if (!confirmed) return;
    clearPayments();
    toast.success('Seluruh transaksi pembayaran dihapus.');
  };

  return (
    <div>
      <PageHeader
        title="Profil & Akun"
        subtitle="Kelola informasi akun, keamanan, dan data aplikasi."
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Kartu identitas */}
        <div className="xl:col-span-1">
          <div className="card card-pad">
            <div className="flex flex-col items-center text-center">
              <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 text-2xl font-bold text-white">
                {initials(session?.name)}
              </div>
              <h2 className="mt-4 text-base font-bold text-slate-900">{session?.name}</h2>
              <p className="text-sm text-slate-500">{session?.email}</p>
              <span className="badge mt-3 bg-primary-50 text-primary-700 ring-1 ring-primary-200">
                <Shield size={13} />
                {ROLE_LABELS[session?.role] ?? session?.role}
              </span>
            </div>

            <dl className="mt-6 space-y-3 border-t border-slate-100 pt-4">
              {[
                { label: 'Role', value: ROLE_LABELS[session?.role] ?? session?.role },
                { label: 'Login terakhir', value: formatDate(session?.logged_in_at, { withTime: true }) },
                { label: 'Total siswa', value: `${formatNumber(DB_META.seedCount)} (seed Excel)` },
                { label: 'Tahun ajaran', value: activeYear?.nama_tahun_ajaran ?? '-' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {item.label}
                  </dt>
                  <dd className="text-sm font-medium text-slate-700">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Form & data */}
        <div className="space-y-5 xl:col-span-2">
          <Section icon={UserRound} title="Informasi Akun" description="Nama dan email pengguna">
            <form onSubmit={handleProfileSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Nama Lengkap" htmlFor="profile-name">
                <input
                  id="profile-name"
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                  className="input"
                />
              </FormField>
              <FormField label="Email" htmlFor="profile-email">
                <input
                  id="profile-email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                  className="input"
                />
              </FormField>
              <div className="sm:col-span-2">
                <button type="submit" disabled={savingProfile} className="btn-primary">
                  {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Simpan Profil
                </button>
              </div>
            </form>
          </Section>

          <Section
            icon={KeyRound}
            title="Keamanan"
            description="Password disimpan sebagai hash SHA-256 + salt, tidak pernah plain text"
          >
            <form onSubmit={handlePasswordSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Password Saat Ini" htmlFor="current-password">
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, current: e.target.value }))}
                  className="input"
                />
              </FormField>
              <FormField label="Password Baru" htmlFor="new-password">
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.next}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, next: e.target.value }))}
                  className="input"
                />
              </FormField>
              <FormField label="Konfirmasi Password" htmlFor="confirm-password">
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                  className="input"
                />
              </FormField>
              <div className="sm:col-span-3">
                <button type="submit" disabled={savingPassword} className="btn-primary">
                  {savingPassword ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <KeyRound size={16} />
                  )}
                  Ubah Password
                </button>
              </div>
            </form>
          </Section>

          <Section
            icon={Database}
            title="Data Aplikasi"
            description="Backup, reset, dan informasi penyimpanan"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button type="button" onClick={handleBackup} className="btn-secondary justify-start">
                <Download size={16} />
                Backup Data (JSON)
              </button>
              <button
                type="button"
                onClick={handleResetPaymentsOnly}
                className="btn-secondary justify-start"
              >
                <Trash2 size={16} />
                Hapus Semua Pembayaran
              </button>
              <button type="button" onClick={handleReset} className="btn-danger justify-start">
                <RefreshCw size={16} />
                Reset Seluruh Data
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Catatan penyimpanan
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Versi ini berjalan sepenuhnya di browser (mode lokal) — data disimpan pada
                <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200">
                  {DB_META.storageKey}
                </code>
                dan tidak dikirim ke server manapun. Struktur tabel sudah mengikuti skema
                relational (students, student_fathers, student_mothers, student_guardians,
                parent_addresses, payments, academic_years) sehingga siap dipindahkan ke
                Supabase/PostgreSQL tanpa mengubah tampilan.
              </p>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
