import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser, LoginInput, RegisterInput } from '@dive/shared';
import { api } from '../api/client';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (input: LoginInput, opts?: { admin?: boolean }) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const r = await api<{ user: AuthUser }>('/auth/me');
      setUser(r.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const login = useCallback(async (input: LoginInput, opts?: { admin?: boolean }) => {
    const r = await api<{ user: AuthUser }>(opts?.admin ? '/auth/admin/login' : '/auth/login', { method: 'POST', body: input });
    setUser(r.user);
    return r.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const r = await api<{ user: AuthUser }>('/auth/register', { method: 'POST', body: input });
    setUser(r.user);
    return r.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const r = await api<{ user: AuthUser }>('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
    setUser(r.user);
    return r.user;
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, reload, changePassword }), [user, loading, login, register, logout, reload, changePassword]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
