'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, clearCsrfToken, setCsrfToken } from './api';
import {
  getDemoSessionUser,
  isDemoMode,
  startDemoMode,
  stopDemoMode,
} from './demo-mode';

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
  isDemo: boolean;
  login: (email: string, password: string) => Promise<void>;
  startDemo: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);

  const refresh = async () => {
    const demoUser = getDemoSessionUser();
    if (demoUser) {
      setUser(demoUser);
      setDemo(true);
      setCsrfToken('demo-csrf-token');
      setLoading(false);
      return;
    }

    try {
      const me = await apiRequest<CurrentUser>('/auth/me', {
        method: 'GET',
        withCsrf: false,
      });
      setUser(me);
      setDemo(false);
      const csrfFromCookie = getCookie('projectoria_csrf');
      if (csrfFromCookie) {
        setCsrfToken(csrfFromCookie);
      }
    } catch {
      setUser(null);
      setDemo(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    stopDemoMode();
    setDemo(false);
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

  const startDemo = async (): Promise<void> => {
    const response = startDemoMode();
    setUser(response.user);
    setDemo(true);
    setCsrfToken(response.csrfToken);
  };

  const logout = async (): Promise<void> => {
    if (isDemoMode()) {
      stopDemoMode();
    } else {
      await apiRequest('/auth/logout', {
        method: 'POST',
      });
    }
    clearCsrfToken();
    setUser(null);
    setDemo(false);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isDemo: demo,
      login,
      startDemo,
      logout,
      refresh,
    }),
    [user, loading, demo],
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
