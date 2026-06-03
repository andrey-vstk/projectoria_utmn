'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, clearCsrfToken, setCsrfToken } from './api';

export type UserRole = 'ADMIN' | 'INITIATOR';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const me = await apiRequest<CurrentUser>('/auth/me', {
        method: 'GET',
        withCsrf: false,
      });
      setUser(me);
      const csrfFromCookie = getCookie('projectoria_csrf');
      if (csrfFromCookie) {
        setCsrfToken(csrfFromCookie);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const response = await apiRequest<{ user: CurrentUser; csrfToken: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        withCsrf: false,
      },
    );

    setUser(response.user);
    setCsrfToken(response.csrfToken);
  };

  const logout = async (): Promise<void> => {
    await apiRequest('/auth/logout', {
      method: 'POST',
    });
    clearCsrfToken();
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refresh,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const raw = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${name}=`));
  if (!raw) return null;
  return decodeURIComponent(raw.slice(name.length + 1));
}
