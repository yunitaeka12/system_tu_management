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
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await authService.login(email, password);
    if (result.ok) {
      setSession(result.session);
      // Popup "ganti password" muncul saat login selama password masih bawaan.
      setPasswordPromptOpen(authService.shouldPromptPasswordChange(result.user));
    }
    return result;
  }, []);

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
      logout,
      refreshSession,
      passwordPromptOpen,
      dismissPasswordPrompt,
      can: (permission) => authService.can(session, permission),
      roleLabel: session ? authService.ROLE_LABELS[session.role] ?? session.role : null,
      isAdministrator: session?.role === authService.ROLES.ADMINISTRATOR,
    }),
    [session, ready, login, logout, refreshSession, passwordPromptOpen, dismissPasswordPrompt],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>.');
  return ctx;
}

export default AuthContext;
