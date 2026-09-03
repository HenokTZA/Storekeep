import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, clearSession, login as apiLogin, setActiveStore } from '@/lib/api';
import { initializeDatabase } from '@/lib/database';
import { secureGet } from '@/lib/storage';
import type { Me, Store } from '@/types';

type AuthValue = {
  loading: boolean;
  authenticated: boolean;
  me: Me | null;
  store: Store | null;
  role: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);

  const loadMe = async () => {
    const profile = await apiFetch<Me>('/auth/me/');
    if (!profile.memberships.length) throw new Error('This account is not assigned to a store.');
    await setActiveStore(profile.memberships[0].store.id);
    setMe(profile);
  };

  useEffect(() => {
    (async () => {
      try {
        await initializeDatabase();
        const refresh = await secureGet('storeledger.refresh');
        if (refresh) await loadMe();
      } catch {
        await clearSession();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthValue>(() => ({
    loading,
    authenticated: Boolean(me),
    me,
    store: me?.memberships[0]?.store || null,
    role: me?.memberships[0]?.role || null,
    login: async (username, password) => {
      await apiLogin(username, password);
      await loadMe();
    },
    logout: async () => {
      await clearSession();
      setMe(null);
    },
    reload: loadMe,
  }), [loading, me]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
