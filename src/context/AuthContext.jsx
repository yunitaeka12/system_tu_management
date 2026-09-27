import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService';
import { initDB } from '../lib/db';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => authService.getSession());
  const [ready, setReady] = useState(false);
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);

  // Muat data (Supabase bila tersedia) lalu pastikan akun bawaan tersedia,
  // semuanya selesai sebelum halaman login tampil.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await initDB();
      } catch (error) {
        console.error('[auth] Gagal menyiapkan database:', error);
      }
      try {
        await authService.ensureSeedUsers();
      } catch (error) {
        console.error('[auth] Gagal menyiapkan akun bawaan:', error);
      }
      // Sesi tersimpan hanya dipercaya bila sesi Supabase Auth (kalau aktif)
      // masih hidup — mis. setelah logout di tab lain atau token kadaluarsa.
      try {
        const restored = await authService.restoreSession();
        if (mounted) {
          setSession(restored);
          setPasswordPromptOpen(
            restored ? authService.shouldPromptPasswordChange(restored) : false,
          );
        }
      } catch (error) {
        console.error('[auth] Gagal memulihkan sesi:', error);
      }
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await authService.login(email, password);
    // result.requiresMfa → sesi belum dibuka; halaman login lanjut meminta kode
    // dari aplikasi authenticator (langkah kedua).
    if (result.ok && result.session) {
      setSession(result.session);
      // Popup "ganti password" muncul saat login selama password masih bawaan.
      setPasswordPromptOpen(authService.shouldPromptPasswordChange(result.session));
    }
    return result;
  }, []);

  /** Mulai pendaftaran authenticator (TOTP) untuk langkah kedua login. */
  const startTotpEnrollment = useCallback(() => authService.startTotpEnrollment(), []);

  /** Verifikasi kode authenticator lalu buka sesi aplikasi. */
  const verifyTotp = useCallback(async (factorId, code, expectedUserId) => {
    const result = await authService.verifyTotp(factorId, code, { expectedUserId });
    if (result.ok) {
      setSession(result.session);
      setPasswordPromptOpen(authService.shouldPromptPasswordChange(result.session));
    }
    return result;
  }, []);

  /** Login memakai akun Google; browser dialihkan ke halaman login Google. */
  const loginWithGoogle = useCallback(
    (redirectTo) => authService.loginWithGoogle(redirectTo),
    [],
  );

  const logout = useCallback(() => {
    authService.logout();
    setSession(null);
    setPasswordPromptOpen(false);
  }, []);

  /** Sinkronkan sesi setelah password diubah. */
  const refreshSession = useCallback(() => {
    setSession(authService.getSession());
  }, []);

  const dismissPasswordPrompt = useCallback(() => setPasswordPromptOpen(false), []);

  const value = useMemo(
    () => ({
      session,
      user: session,
      isAuthenticated: Boolean(session),
      ready,
      login,
      loginWithGoogle,
      startTotpEnrollment,
      verifyTotp,
      logout,
      refreshSession,
      passwordPromptOpen,
      dismissPasswordPrompt,
      can: (permission) => authService.can(session, permission),
      roleLabel: session ? authService.ROLE_LABELS[session.role] ?? session.role : null,
      isAdministrator: session?.role === authService.ROLES.ADMINISTRATOR,
    }),
    [
      session,
      ready,
      login,
      loginWithGoogle,
      startTotpEnrollment,
      verifyTotp,
      logout,
      refreshSession,
      passwordPromptOpen,
      dismissPasswordPrompt,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>.');
  return ctx;
}

export default AuthContext;
