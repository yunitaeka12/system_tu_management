import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import RouteTransition from './RouteTransition';
import ChangePasswordPrompt from './ChangePasswordPrompt';
import SessionGuard from './SessionGuard';

const COLLAPSE_KEY = 'assalam.tu.sidebar.collapsed';

export default function Layout() {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, String(collapsed));
    } catch {
      /* diabaikan */
    }
  }, [collapsed]);

  // Tutup drawer mobile setiap kali ukuran layar naik ke desktop.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <div className="w-full">
            {/* key per-pathname → halaman di-remount & animasi masuk jalan lagi */}
            <RouteTransition key={pathname}>
              <Outlet />
            </RouteTransition>
          </div>
        </main>
        <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-400">
          <span className="block sm:inline">
            © {new Date().getFullYear()} SDIT As-Salam Islamic Green School — Sistem Informasi Tata
            Usaha
          </span>
          <span className="mt-1 block sm:mt-0 sm:ml-2 sm:inline">
            · Wira | Eka, All Rights Reserved.
          </span>
        </footer>
      </div>

      <ChangePasswordPrompt />
      <SessionGuard />
    </div>
  );
}
