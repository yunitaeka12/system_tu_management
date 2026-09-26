import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Lock, ShieldAlert } from 'lucide-react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { verifyUserPassword } from '../services/authService';
import { toast } from '../lib/toast';

/** Interval konfirmasi password (3 jam). */
const REAUTH_INTERVAL_MS = 3 * 60 * 60 * 1000;
/** Batas waktu memasukkan password sebelum otomatis logout (1 menit). */
const GRACE_SECONDS = 60;

const LAST_VERIFY_KEY = 'assalam.tu.last_verify';

function readLastVerify(session) {
  try {
    const raw = localStorage.getItem(LAST_VERIFY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.user_id === session.user_id) return new Date(parsed.at).getTime();
    }
  } catch {
    /* diabaikan */
  }
  return session.logged_in_at ? new Date(session.logged_in_at).getTime() : Date.now();
}

function writeLastVerify(session) {
  try {
    localStorage.setItem(
      LAST_VERIFY_KEY,
      JSON.stringify({ user_id: session.user_id, at: new Date().toISOString() }),
    );
  } catch {
    /* diabaikan */
  }
}

function clearLastVerify() {
  try {
    localStorage.removeItem(LAST_VERIFY_KEY);
  } catch {
    /* diabaikan */
  }
}

/**
 * Penjaga sesi:
 * - setiap 3 jam meminta password kembali;
 * - bila dibatalkan, pengguna langsung logout;
 * - bila password tidak dimasukkan dalam 1 menit, otomatis logout.
 */
export default function SessionGuard() {
  const { session, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(GRACE_SECONDS);
  const [checking, setChecking] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState(0);
  const endedRef = useRef(false);

  const endSession = useCallback(
    (message) => {
      if (endedRef.current) return;
      endedRef.current = true;
      clearLastVerify();
      setOpen(false);
      // ProtectedRoute otomatis mengarahkan ke halaman login setelah sesi hilang.
      logout();
      toast.warning(message, 'Sesi berakhir');
    },
    [logout],
  );

  // Jadwalkan permintaan password berikutnya.
  useEffect(() => {
    if (!session) return undefined;
    const dueAt = readLastVerify(session) + REAUTH_INTERVAL_MS;
    const delay = Math.max(dueAt - Date.now(), 0);
    const timer = setTimeout(() => {
      endedRef.current = false;
      setPassword('');
      setError('');
      setRemaining(GRACE_SECONDS);
      setOpen(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [session, verifiedAt]);

  // Hitung mundur 60 detik saat modal terbuka.
  useEffect(() => {
    if (!open) return undefined;
    setRemaining(GRACE_SECONDS);
    const interval = setInterval(() => {
      setRemaining((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [open]);

  // Waktu habis → logout otomatis.
  useEffect(() => {
    if (open && remaining === 0) {
      endSession('Tidak ada konfirmasi password dalam 1 menit — Anda otomatis keluar.');
    }
  }, [open, remaining, endSession]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!password) {
      setError('Password wajib diisi.');
      return;
    }
    setChecking(true);
    const result = await verifyUserPassword(session?.user_id, password);
    setChecking(false);

    if (!result.ok) {
      setError(result.error || 'Password salah.');
      return;
    }

    writeLastVerify(session);
    setVerifiedAt(Date.now());
    setPassword('');
    setError('');
    setOpen(false);
    toast.success('Verifikasi berhasil. Sesi diperpanjang 3 jam.');
  };

  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, '0');

  return (
    <Modal
      open={open}
      onClose={() =>
        endSession('Anda keluar karena membatalkan verifikasi password.')
      }
      title="Konfirmasi Password"
      description="Demi keamanan data siswa, sesi diperbarui setiap 3 jam."
      size="sm"
      closeOnBackdrop={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Masukkan password dalam {minutes}:{seconds}
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Jika waktu habis atau Anda menekan “Batalkan”, sesi akan diakhiri dan Anda keluar dari
              aplikasi.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="reauth-password" className="label">
            Password Akun
          </label>
          <div className="relative">
            <Lock
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              id="reauth-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input pl-10"
              autoFocus
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            <AlertTriangle size={15} />
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => endSession('Anda keluar karena membatalkan verifikasi password.')}
            className="btn-secondary"
          >
            Batalkan
          </button>
          <button type="submit" disabled={checking} className="btn-primary">
            {checking ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
            {checking ? 'Memeriksa…' : 'Lanjutkan Sesi'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
