import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { driverApi } from '@/src/lib/api';
import { useAuth } from './auth-provider';

const RequiredDocumentsContext = createContext<{
  count: number | null;
  expiredCount: number | null;
  updateCount: (count: number, expiredCount: number) => void;
  refresh: () => Promise<void>;
} | null>(null);

// Mounted with the session token as its key so another driver never inherits a badge.
export function RequiredDocumentsProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const token = session?.token;
  const [count, setCount] = useState<number | null>(null);
  const [expiredCount, setExpiredCount] = useState<number | null>(null);
  const request = useRef(0);
  const updateCount = useCallback((value: number, expired: number) => {
    request.current++;
    setCount(Math.max(0, value));
    setExpiredCount(Math.max(0, expired));
  }, []);
  const refresh = useCallback(async () => {
    if (!token) return;
    const version = ++request.current;
    try {
      const dashboard = await driverApi.dashboard(token);
      if (version === request.current) {
        setCount(dashboard.documents.missing_required_count);
        setExpiredCount(dashboard.documents.expired_count);
      }
    } catch {
      // A failed refresh must not erase a previously confirmed requirement.
    }
  }, [token]);

  useEffect(() => {
    const requests = request;
    let mounted = true;
    void Promise.resolve().then(() => { if (mounted) void refresh(); });
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => { mounted = false; requests.current++; subscription.remove(); };
  }, [refresh]);

  return <RequiredDocumentsContext.Provider value={{ count, expiredCount, updateCount, refresh }}>{children}</RequiredDocumentsContext.Provider>;
}

export function useRequiredDocuments() {
  const context = useContext(RequiredDocumentsContext);
  if (!context) throw new Error('RequiredDocumentsProvider is required.');
  return context;
}
