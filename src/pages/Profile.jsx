import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Save, Shield, UserRound } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import FormField from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { updateProfile, ROLE_LABELS } from '../services/authService';
import { isSupabaseAuthEnabled } from '../lib/supabase';
import { cn } from '../utils/helpers';
import { DB_META } from '../lib/db';
import { toast } from '../lib/toast';
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

  return (
    <div>
      <PageHeader
        title="Profil & Akun"
        subtitle="Kelola informasi akun Anda."
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
              <FormField
                label="Email"
                htmlFor="profile-email"
                hint={
                  isSupabaseAuthEnabled
                    ? 'Email login dikelola di Supabase — ubah lewat dashboard Supabase.'
                    : undefined
                }
              >
                <input
                  id="profile-email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                  disabled={isSupabaseAuthEnabled}
                  className={cn(
                    'input',
                    isSupabaseAuthEnabled && 'cursor-not-allowed bg-slate-100 text-slate-500',
                  )}
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
        </div>
      </div>
    </div>
  );
}
