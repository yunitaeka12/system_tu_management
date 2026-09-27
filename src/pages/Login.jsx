import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, BookOpen, CreditCard, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { getPendingMfa } from '../services/authService';
import { isSupabaseAuthEnabled } from '../lib/supabase';
import { toast } from '../lib/toast';

/**
 * Supabase menaruh kegagalan login (mis. sesi OAuth kadaluarsa) sebagai parameter
 * di URL. Dibaca sekali lalu dibersihkan supaya tidak menempel saat di-refresh.
 */
function readOAuthError() {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search.replace(/^\?/, ''));
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const message =
    params.get('error_description') ||
    hashParams.get('error_description') ||
    params.get('error') ||
    hashParams.get('error');
  if (!message) return '';

  const { pathname, search, hash } = window.location;
  const cleanedSearch = new URLSearchParams(search);
  const cleanedHash = new URLSearchParams(hash);
  ['error', 'error_code', 'error_description'].forEach((key) => {
    cleanedSearch.delete(key);
    cleanedHash.delete(key);
  });
  const nextSearch = cleanedSearch.toString();
  const nextHash = cleanedHash.toString();
  window.history.replaceState(
    {},
    '',
    `${pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash ? `#${nextHash}` : ''}`,
  );

  return String(message).replace(/\+/g, ' ');
}

/** QR pendaftaran authenticator (Supabase mengirim data-URI SVG). */
function QrCode({ value }) {
  if (!value) return null;
  if (String(value).trim().startsWith('<svg')) {
    return (
      <div
        className="h-44 w-44 [&>svg]:h-full [&>svg]:w-full"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  }
  return <img src={value} alt="QR pendaftaran authenticator" className="h-44 w-44" />;
}

const HIGHLIGHTS = [
  { icon: BookOpen, title: 'Buku Induk Digital', text: 'Seluruh data siswa 1.252+ terpusat & mudah dicari.' },
  { icon: CreditCard, title: 'Pembayaran Otomatis', text: 'Tagihan, sisa, dan status dihitung otomatis.' },
  { icon: ShieldCheck, title: 'Aman & Terkendali', text: 'Autentikasi, role akses, dan jejak audit.' },
];

export default function Login() {
  const { login, startTotpEnrollment, verifyTotp, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/';

  // Langkah 2 (kode authenticator) bisa dilanjutkan walau halaman di-refresh.
  const [pending, setPending] = useState(() => getPendingMfa());
  const [step, setStep] = useState(() => (getPendingMfa() ? 'mfa' : 'credentials'));
  const [factorId, setFactorId] = useState(() => getPendingMfa()?.factorId ?? null);
  const [qrCode, setQrCode] = useState(null);
  const [secret, setSecret] = useState(null);
  const [code, setCode] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(() => readOAuthError());
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [enrollFailed, setEnrollFailed] = useState(false);
  const [enrollAttempt, setEnrollAttempt] = useState(0);

  /** Belum punya authenticator → siapkan QR pendaftaran. */
  useEffect(() => {
    if (step !== 'mfa' || factorId || pending?.mode !== 'enroll') return;
    let active = true;
    (async () => {
      setPreparing(true);
      setEnrollFailed(false);
      const result = await startTotpEnrollment();
      if (!active) return;
      setPreparing(false);
      if (!result.ok) {
        setError(result.error);
        setEnrollFailed(true);
        return;
      }
      setError('');
      setFactorId(result.factorId);
      setQrCode(result.qrCode);
      setSecret(result.secret);
    })();
    return () => {
      active = false;
    };
  }, [step, factorId, pending, startTotpEnrollment, enrollAttempt]);

  const retryEnroll = () => {
    setQrCode(null);
    setSecret(null);
    setEnrollFailed(false);
    setError('');
    setEnrollAttempt((value) => value + 1);
  };

  /** Langkah 1: email + password. */
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

    // Password benar → lanjut langkah 2 (kode authenticator).
    if (result.ok && result.requiresMfa) {
      setPending({
        email: result.email,
        userId: result.user?.id ?? null,
        mode: result.mfaMode,
        factorId: result.factorId ?? null,
      });
      setQrCode(null);
      setSecret(null);
      setCode('');
      setFactorId(result.mfaMode === 'verify' ? result.factorId : null);
      setStep('mfa');
      return;
    }

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

  /** Langkah 2: kode 6 angka dari aplikasi authenticator. */
  const handleVerifyCode = async (event) => {
    event.preventDefault();
    setError('');

    if (!pending?.email) {
      setStep('credentials');
      return;
    }

    setLoading(true);
    const result = await verifyTotp(factorId, code, pending.userId);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      setLocked(Boolean(result.locked));
      if (result.locked) toast.error('Akun terkunci — hubungi Administrator.');
      else if (result.remaining > 0) toast.warning(result.error);
      else toast.error(result.error, 'Kode tidak valid');
      return;
    }

    setLocked(false);
    toast.success(`Selamat datang, ${result.user.name}.`);
    navigate(redirectTo, { replace: true });
  };

  /** Batal di langkah 2: sesi password Supabase yang belum terpakai dihapus. */
  const handleCancelMfa = () => {
    logout();
    setPending(null);
    setFactorId(null);
    setQrCode(null);
    setSecret(null);
    setCode('');
    setError('');
    setLocked(false);
    setStep('credentials');
  };

  const mfaHeading = qrCode ? 'Daftarkan Authenticator' : 'Verifikasi Dua Langkah';

  return (
    <div
      className="relative grid min-h-screen bg-slate-900 bg-cover bg-center bg-no-repeat lg:grid-cols-2"
      style={{ backgroundImage: "url('/bglogin.png')" }}
    >
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary-900/85 via-primary-950/80 to-slate-950/90 p-10 backdrop-blur-[2px] lg:flex lg:flex-col lg:justify-between">
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
          className="w-full max-w-sm rounded-lg border border-white/60 bg-white p-6 shadow-xl sm:p-8"
        >
          <div className="lg:hidden">
            <Logo size="md" />
          </div>

          <h2 className="mt-8 text-2xl font-bold tracking-tight text-slate-900 lg:mt-0">
            {step === 'mfa' ? mfaHeading : 'Masuk ke Akun Anda'}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {step === 'mfa'
              ? 'Satu langkah lagi — masukkan kode dari aplikasi authenticator Anda.'
              : isSupabaseAuthEnabled
                ? 'Masuk dengan password, lalu konfirmasi kode dari aplikasi authenticator.'
                : 'Gunakan akun Tata Usaha untuk mengakses sistem.'}
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
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

          {step === 'mfa' ? (
            /* Langkah 2 — kode dari aplikasi authenticator */
            <form onSubmit={handleVerifyCode} className="mt-4 space-y-4" noValidate>
              {preparing ? (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs text-slate-500">
                  <Loader2 size={14} className="animate-spin" />
                  Menyiapkan QR pendaftaran…
                </div>
              ) : enrollFailed ? (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-800">
                  <p>
                    Pendaftaran authenticator ditolak Supabase. Biasanya karena{' '}
                    <strong>TOTP belum diaktifkan</strong> di project: buka{' '}
                    <strong>Authentication → Multi-Factor</strong>, aktifkan <strong>TOTP</strong>{' '}
                    lalu klik Coba lagi.
                  </p>
                  <button type="button" onClick={retryEnroll} className="btn-secondary btn-sm">
                    Coba lagi
                  </button>
                </div>
              ) : qrCode ? (
                <>
                  <div className="rounded-xl border border-school-200 bg-school-50 px-3.5 py-3 text-xs leading-relaxed text-school-800">
                    Pasang aplikasi authenticator (Google Authenticator, Authy, atau Microsoft
                    Authenticator), lalu scan QR di bawah ini.
                  </div>
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <QrCode value={qrCode} />
                    {secret && (
                      <p className="text-center text-[11px] leading-relaxed text-slate-500">
                        Tidak bisa scan? Masukkan kode ini secara manual:
                        <br />
                        <span className="font-mono text-xs font-semibold tracking-wider text-slate-700">
                          {secret}
                        </span>
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-school-200 bg-school-50 px-3.5 py-3 text-xs leading-relaxed text-school-800">
                  Password benar. Masukkan 6 angka dari aplikasi authenticator untuk akun{' '}
                  <span className="font-semibold">{pending?.email}</span>.
                </div>
              )}

              <div>
                <label htmlFor="totp-code" className="label">
                  Kode 6 Angka
                </label>
                <input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="input text-center text-lg font-semibold tracking-[0.35em]"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || preparing || !factorId || enrollFailed}
                className="btn-primary w-full"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Memeriksa…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    {qrCode ? 'Aktifkan & Masuk' : 'Masuk'}
                  </>
                )}
              </button>

              <div className="text-center text-xs">
                <button
                  type="button"
                  onClick={handleCancelMfa}
                  className="text-slate-500 transition hover:text-slate-700"
                >
                  Ganti akun
                </button>
              </div>
            </form>
          ) : (
            /* Langkah 1 — email + password */
            <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
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
          )}

          <p className="mt-4 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs leading-relaxed text-slate-500">
            Tidak bisa masuk atau akun terkunci? Hubungi Administrator TU untuk bantuan akses.
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
