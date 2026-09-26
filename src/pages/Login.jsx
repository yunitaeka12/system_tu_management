import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, BookOpen, CreditCard, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { toast } from '../lib/toast';

const HIGHLIGHTS = [
  { icon: BookOpen, title: 'Buku Induk Digital', text: 'Seluruh data siswa 1.252+ terpusat & mudah dicari.' },
  { icon: CreditCard, title: 'Pembayaran Otomatis', text: 'Tagihan, sisa, dan status dihitung otomatis.' },
  { icon: ShieldCheck, title: 'Aman & Terkendali', text: 'Autentikasi, role akses, dan jejak audit.' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.email || !form.password) {
      setError('Email dan password wajib diisi.');
      return;
    }

    setLoading(true);
    const result = await login(form.email, form.password);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      setLocked(Boolean(result.locked));
      if (result.locked) toast.error('Akun terkunci — hubungi Administrator.');
      else if (result.remaining > 0) toast.warning(result.error);
      else toast.error(result.error, 'Login gagal');
      return;
    }

    setLocked(false);
    toast.success(`Selamat datang, ${result.user.name}.`);
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950 p-10 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-white backdrop-blur">
              <Logo iconOnly size="sm" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">SDIT As-Salam</p>
              <p className="text-xs font-medium text-school-300">Islamic Green School</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-3xl font-bold leading-snug tracking-tight text-white"
          >
            Sistem Informasi Tata Usaha
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="mt-3 text-sm leading-relaxed text-primary-100/80"
          >
            Kelola Buku Induk, tagihan, dan pembayaran siswa dalam satu aplikasi.
            Sederhana untuk TU, powerful di belakang layar.
          </motion.p>

          <div className="mt-8 space-y-4">
            {HIGHLIGHTS.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 0.15 + index * 0.08 }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 text-school-300">
                    <Icon size={17} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-primary-100/70">{item.text}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <p className="relative text-xs text-primary-200/60">
          © {new Date().getFullYear()} SDIT As-Salam Islamic Green School · Wira | Eka, All Rights
          Reserved.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden">
            <Logo size="md" />
          </div>

          <h2 className="mt-8 text-2xl font-bold tracking-tight text-slate-900 lg:mt-0">
            Masuk ke Akun Anda
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Gunakan akun Tata Usaha untuk mengakses sistem.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="nama@assalam.sch.id"
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="input pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition hover:text-slate-600"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <span>{error}</span>
                  {locked && (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      Hubungi Administrator TU untuk membuka kembali akses akun Anda.
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Memproses…
                </>
              ) : (
                'Masuk'
              )}
            </button>
          </form>

          <p className="mt-4 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs leading-relaxed text-slate-500">
            Lupa password atau akun terkunci? Hubungi Administrator TU untuk bantuan akses.
          </p>

          <p className="mt-6 text-center text-xs text-slate-400">
            <Link to="/" className="transition hover:text-slate-600">
              Kembali ke beranda
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
