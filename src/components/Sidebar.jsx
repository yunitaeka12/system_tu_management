import { NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  CreditCard,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import { confirmDialog, toast } from '../lib/toast';
import { cn, initials } from '../utils/helpers';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/buku-induk', label: 'Buku Induk', icon: BookOpen },
  { to: '/pembayaran', label: 'Pembayaran', icon: CreditCard },
  { to: '/report', label: 'Report Pembayaran', icon: FileSpreadsheet, permission: 'payment.view' },
];

function NavItem({ item, collapsed, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-white/[0.06] text-white'
            : 'text-slate-300/90 hover:bg-white/5 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 bg-primary-400" />
          )}
          <Icon
            size={19}
            strokeWidth={isActive ? 2.4 : 2}
            className={cn('shrink-0', isActive && 'text-primary-300')}
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
          {collapsed && (
            <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-dropdown ring-1 ring-white/10 transition-opacity group-hover:block group-hover:opacity-100">
              {item.label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({
  collapsed,
  onNavigate,
  onToggle,
  onLogout,
  user,
  roleLabel,
  isAdmin,
  canSettings,
  navItems = NAV_ITEMS,
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={cn('flex items-center gap-2 px-4 py-5', collapsed && 'justify-center px-2')}>
        <Logo iconOnly={collapsed} onDark />
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="ml-auto hidden rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white lg:inline-flex"
            aria-label="Ciutkan sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={onToggle}
          className="mx-auto mb-2 hidden rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white lg:inline-flex"
          aria-label="Perluas sidebar"
        >
          <PanelLeftOpen size={18} />
        </button>
      )}

      {/* Menu */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {!collapsed && (
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Menu Utama
          </p>
        )}
        {navItems.map((item) => (
          <NavItem key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}

        {(isAdmin || canSettings) && (
          <div className="pt-3">
            {!collapsed && (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Administrasi
              </p>
            )}
            {canSettings && (
              <NavItem
                item={{ to: '/pengaturan', label: 'Pengaturan', icon: Settings }}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            )}
            {isAdmin && (
              <NavItem
                item={{ to: '/admin', label: 'Admin Panel', icon: ShieldCheck }}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            )}
          </div>
        )}
      </nav>

      {/* User + logout */}
      <div className="border-t border-white/10 p-3">
        {!collapsed && user && (
          <div className="mb-2 flex items-center gap-2.5 rounded-md bg-white/5 px-3 py-2 ring-1 ring-white/5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-500/20 text-xs font-bold text-primary-200">
              {initials(user.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{user.name}</p>
              <p className="truncate text-[11px] text-slate-400">{roleLabel}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onLogout}
          className={cn(
            'group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-red-500/15 hover:text-red-300',
            collapsed && 'justify-center px-0',
          )}
        >
          <LogOut size={19} strokeWidth={2} className="shrink-0" />
          {!collapsed && 'Logout'}
          {collapsed && (
            <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-dropdown ring-1 ring-white/10 transition-opacity group-hover:block group-hover:opacity-100">
              Logout
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }) {
  const { user, roleLabel, logout, isAdministrator, can } = useAuth();
  const canSettings = can('settings.manage');
  const navigate = useNavigate();
  const navItems = NAV_ITEMS.filter((item) => !item.permission || can(item.permission));

  const handleLogout = async () => {
    const confirmed = await confirmDialog({
      title: 'Keluar dari aplikasi?',
      text: 'Anda perlu masuk kembali untuk mengakses data Tata Usaha.',
      confirmText: 'Ya, logout',
      icon: 'question',
    });
    if (!confirmed) return;
    logout();
    toast.success('Anda telah keluar dari aplikasi.');
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* Desktop */}
      <motion.aside
        animate={{ width: collapsed ? 76 : 264 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 hidden h-screen shrink-0 border-r border-slate-800 bg-slate-900 lg:block"
      >
        <SidebarContent
          collapsed={collapsed}
          onToggle={onToggle}
          onLogout={handleLogout}
          user={user}
          roleLabel={roleLabel}
          isAdmin={isAdministrator}
          canSettings={canSettings}
          navItems={navItems}
        />
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={onCloseMobile}
              className="fixed inset-0 z-40 bg-slate-950/70 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="fixed inset-y-0 left-0 z-50 w-[272px] border-r border-slate-800 bg-slate-900 lg:hidden"
            >
              <button
                type="button"
                onClick={onCloseMobile}
                className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Tutup menu"
              >
                <X size={18} />
              </button>
              <SidebarContent
                collapsed={false}
                onNavigate={onCloseMobile}
                onLogout={handleLogout}
                user={user}
                roleLabel={roleLabel}
                isAdmin={isAdministrator}
                canSettings={canSettings}
                navItems={navItems}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
