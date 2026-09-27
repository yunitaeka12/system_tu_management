import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BadgeCheck, Database, LayoutGrid, ShieldCheck, Trash2, UserCog } from 'lucide-react';
import AdminOverview from '../components/admin/AdminOverview';
import AdminUsers from '../components/admin/AdminUsers';
import AdminPermissions from '../components/admin/AdminPermissions';
import AdminBulkDelete from '../components/admin/AdminBulkDelete';
import { useAuth } from '../context/AuthContext';
import { cn, initials } from '../utils/helpers';

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan', icon: LayoutGrid },
  { key: 'pengguna', label: 'Pengguna', icon: UserCog },
  { key: 'hak-akses', label: 'Hak Akses', icon: ShieldCheck },
  { key: 'hapus-massal', label: 'Hapus Massal', icon: Trash2 },
];

export default function AdminPanel() {
  const { session, isAdministrator, roleLabel } = useAuth();
  const [tab, setTab] = useState('ringkasan');

  if (!isAdministrator) {
    return (
      <div className="card card-pad text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
          <ShieldCheck size={26} />
        </div>
        <h1 className="mt-4 text-lg font-bold text-slate-900">Akses Terbatas</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">
          Menu Administrator hanya dapat dibuka oleh akun dengan role Administrator.
        </p>
        <Link to="/" className="btn-primary mt-5 inline-flex">
          <ArrowLeft size={16} />
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-shell p-5 sm:p-6">
      {/* Header */}
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary-600 text-white">
            <Database size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Admin Panel</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Kelola pengguna, hak akses, dan data sistem Tata Usaha.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 sm:flex">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-500/20 text-xs font-bold text-primary-100">
              {initials(session?.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{session?.name}</p>
              <p className="truncate text-[11px] text-slate-400">{roleLabel}</p>
            </div>
          </div>
          <Link
            to="/"
            className="dark-btn-ghost dark-btn-sm"
          >
            <ArrowLeft size={14} />
            Dasbor
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative mt-6 flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1.5">
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
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
              )}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Konten */}
      <div className="relative mt-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'ringkasan' && <AdminOverview />}
            {tab === 'pengguna' && <AdminUsers />}
            {tab === 'hak-akses' && <AdminPermissions />}
            {tab === 'hapus-massal' && <AdminBulkDelete />}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="relative mt-6 flex items-center gap-1.5 text-[11px] text-slate-500">
        <BadgeCheck size={13} />
        Semua perubahan tersimpan ke database Supabase bila sinkronisasi aktif.
      </p>
    </div>
  );
}
