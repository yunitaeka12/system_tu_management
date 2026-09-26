import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, LogOut, Menu, UserRound } from 'lucide-react';
import SyncStatus from './SyncStatus';
import { useAuth } from '../context/AuthContext';
import { confirmDialog, toast } from '../lib/toast';
import { cn, initials } from '../utils/helpers';

const LABELS = {
  'buku-induk': 'Buku Induk',
  pembayaran: 'Pembayaran',
  ekskul: 'Ekskul',
  admin: 'Admin Panel',
  pengaturan: 'Pengaturan',
  profil: 'Profil',
  import: 'Import Excel',
  baru: 'Tambah Siswa',
  edit: 'Edit',
  tambah: 'Add Pembayaran',
};

function useBreadcrumb() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  const crumbs = [{ label: 'Dashboard', to: '/' }];

  parts.forEach((part, index) => {
    const to = `/${parts.slice(0, index + 1).join('/')}`;
    const isId = /^stu_/.test(part);
    const label = isId ? 'Detail' : LABELS[part] || part;
    crumbs.push({ label, to });
  });

  return crumbs;
}

function UserMenu() {
  const { user, roleLabel, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    const confirmed = await confirmDialog({
      title: 'Keluar dari aplikasi?',
      text: 'Anda perlu masuk kembali untuk mengakses data Tata Usaha.',
      confirmText: 'Ya, logout',
      icon: 'question',
    });
    if (!confirmed) return;
    logout();
    toast.success('Berhasil logout.');
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-xl border border-transparent px-1.5 py-1.5 transition hover:border-slate-200 hover:bg-slate-50"
      >
        <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-600 text-xs font-bold text-white">
          {initials(user?.name)}
        </div>
        <div className="hidden text-left sm:block">
          <p className="max-w-[140px] truncate text-xs font-semibold text-slate-800">
            {user?.name}
          </p>
          <p className="text-[11px] text-slate-500">{roleLabel}</p>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-dropdown"
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="truncate text-sm font-semibold text-slate-800">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
            <div className="p-1.5">
              <Link
                to="/profil"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <UserRound size={16} />
                Profil & Akun
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-red-50 hover:text-red-600"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Header({ onOpenMobile }) {
  const crumbs = useBreadcrumb();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMobile}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          aria-label="Buka menu"
        >
          <Menu size={20} />
        </button>

        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex items-center gap-1.5 text-sm">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <li key={crumb.to} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 && <ChevronRight size={14} className="shrink-0 text-slate-300" />}
                  {isLast ? (
                    <span className="truncate font-semibold text-slate-800">{crumb.label}</span>
                  ) : (
                    <Link
                      to={crumb.to}
                      className="truncate text-slate-500 transition hover:text-primary-600"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <SyncStatus />
        <UserMenu />
      </div>
    </header>
  );
}
