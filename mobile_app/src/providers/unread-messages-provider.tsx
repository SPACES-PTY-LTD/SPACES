import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import { chatApi } from '@/src/lib/api';
import { useAuth } from './auth-provider';

const UnreadMessagesContext = createContext<{ count: number; refresh: () => Promise<void> } | null>(null);

export function UnreadMessagesProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const token = session?.token;
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    if (!token || AppState.currentState !== 'active') return;
    const version = ++request.current;
    try {
      const result = await chatApi.unread(token);
      if (version === request.current && AppState.currentState === 'active') setCount(result.unread_count);
    } catch {
      // Keep the last confirmed count until the next successful refresh.
    }
  }, [token]);
  useEffect(() => {
    const requests = request;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (timer) clearInterval(timer);
      void refresh();
      timer = setInterval(() => void refresh(), 10000);
    };
    const stop = () => { requests.current++; if (timer) clearInterval(timer); timer = undefined; };
    if (AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') start(); else stop(); });
    return () => { stop(); subscription.remove(); };
  }, [refresh, pathname]);
  return <UnreadMessagesContext.Provider value={{ count, refresh }}>{children}</UnreadMessagesContext.Provider>;
}

export function useUnreadMessages() {
  const context = useContext(UnreadMessagesContext);
  if (!context) throw new Error('UnreadMessagesProvider is required.');
  return context;
}
