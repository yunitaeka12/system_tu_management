import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';

import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BukuInduk from './pages/BukuInduk';
import StudentDetail from './pages/StudentDetail';
import StudentForm from './pages/StudentForm';
import ImportBukuInduk from './pages/ImportBukuInduk';
import Pembayaran from './pages/Pembayaran';
import PaymentDetail from './pages/PaymentDetail';
import AddPembayaran from './pages/AddPembayaran';
import ReportPembayaran from './pages/ReportPembayaran';
import AdminPanel from './pages/AdminPanel';
import Pengaturan from './pages/Pengaturan';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

function ProtectedRoute({ children }) {
  const { isAuthenticated, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary-200 border-t-primary-600" />
          <p className="text-sm text-slate-500">Menyiapkan aplikasi…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, ready } = useAuth();
  if (ready && isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

/**
 * Batasi halaman berdasarkan hak akses. Mencegah pengguna yang hanya boleh
 * melihat data membuka halaman tambah/ubah/import lewat URL langsung.
 */
function RequirePermission({ permission, permissions, children }) {
  const { can } = useAuth();
  const required = permissions || (permission ? [permission] : []);
  const fallback = [
    ['/', 'Dashboard', ['menu.dashboard']],
    ['/buku-induk', 'Buku Induk', ['menu.students', 'student.view']],
    ['/pembayaran', 'Pembayaran', ['menu.payments', 'payment.view']],
    ['/report', 'Report Pembayaran', ['menu.report', 'payment.view']],
    ['/pengaturan', 'Pengaturan', ['menu.settings', 'settings.manage']],
    ['/profil', 'Profil & Akun', ['menu.profile']],
  ].find(([, , access]) => access.every((item) => can(item)));
  if (required.some((item) => !can(item))) {
    return (
      <div className="card card-pad text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-slate-100 text-slate-400">
          <ShieldCheck size={26} />
        </div>
        <h1 className="mt-4 text-lg font-bold text-slate-900">Akses Terbatas</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">
          Akun Anda tidak memiliki hak untuk menambah atau mengubah data. Hubungi Administrator bila
          memang membutuhkannya.
        </p>
        {fallback && (
          <Link to={fallback[0]} className="btn-primary mt-5 inline-flex">
            <ArrowLeft size={16} />
            Kembali ke {fallback[1]}
          </Link>
        )}
      </div>
    );
  }
  return children;
}

/**
 * Catatan penting: TIDAK memakai <AnimatePresence mode="wait"> di sekitar
 * <Routes key={pathname}>. Pola itu me-remount seluruh <Layout /> (termasuk
 * Sidebar) saat transisi keluar, sehingga dua Sidebar dengan `layoutId`
 * yang sama hidup bersamaan — framer-motion melempar error di tengah render
 * dan aplikasi membeku (konten blank, klik tidak merespons).
 * Transisi halaman kini ditangani di dalam Layout dengan key per-pathname.
 */
function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/"
          element={
            <RequirePermission permission="menu.dashboard">
              <Dashboard />
            </RequirePermission>
          }
        />
        <Route
          path="/buku-induk"
          element={
            <RequirePermission permissions={['menu.students', 'student.view']}>
              <BukuInduk />
            </RequirePermission>
          }
        />
        <Route
          path="/buku-induk/import"
          element={
            <RequirePermission permissions={['menu.students', 'student.import']}>
              <ImportBukuInduk />
            </RequirePermission>
          }
        />
        <Route
          path="/buku-induk/baru"
          element={
            <RequirePermission permissions={['menu.students', 'student.create']}>
              <StudentForm mode="create" />
            </RequirePermission>
          }
        />
        <Route
          path="/buku-induk/:id"
          element={
            <RequirePermission permissions={['menu.students', 'student.view']}>
              <StudentDetail />
            </RequirePermission>
          }
        />
        <Route
          path="/buku-induk/:id/edit"
          element={
            <RequirePermission permissions={['menu.students', 'student.update']}>
              <StudentForm mode="edit" />
            </RequirePermission>
          }
        />
        <Route
          path="/pembayaran"
          element={
            <RequirePermission permissions={['menu.payments', 'payment.view']}>
              <Pembayaran />
            </RequirePermission>
          }
        />
        <Route
          path="/pembayaran/:studentId/tambah"
          element={
            <RequirePermission permissions={['menu.payments', 'payment.create']}>
              <AddPembayaran />
            </RequirePermission>
          }
        />
        <Route
          path="/pembayaran/:studentId"
          element={
            <RequirePermission permissions={['menu.payments', 'payment.view']}>
              <PaymentDetail />
            </RequirePermission>
          }
        />
        <Route
          path="/report"
          element={
            <RequirePermission permissions={['menu.report', 'payment.view']}>
              <ReportPembayaran />
            </RequirePermission>
          }
        />
        <Route path="/admin" element={<AdminPanel />} />
        <Route
          path="/pengaturan"
          element={
            <RequirePermission permissions={['menu.settings', 'settings.manage']}>
              <Pengaturan />
            </RequirePermission>
          }
        />
        <Route
          path="/profil"
          element={
            <RequirePermission permission="menu.profile">
              <Profile />
            </RequirePermission>
          }
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <DataProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </DataProvider>
    </ErrorBoundary>
  );
}
