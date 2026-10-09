import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { driverApi, type PhoneLocationSettings } from '@/src/lib/api';
import { useAuth } from './auth-provider';

type LocationContextValue = {
  settings: PhoneLocationSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  permissionRequired: boolean;
  refresh: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
};
const Context = createContext<LocationContextValue | null>(null);

export function PhoneLocationProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const token = session?.token;
  const [settings, setSettings] = useState<PhoneLocationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionRequired, setPermissionRequired] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const mutating = useRef(false);
  const mounted = useRef(true);
  const revision = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const refresh = useCallback(async () => {
    if (!token || mutating.current) return;
    const version = ++revision.current;
    try {
      const next = await driverApi.locationSharing(token);
      if (!mounted.current || version !== revision.current) return;
      setSettings(next);
      setError(null);
    } catch (e) {
      if (mounted.current && version === revision.current) setError(e instanceof Error ? e.message : 'Unable to load location settings.');
    } finally {
      if (mounted.current && version === revision.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const setEnabled = useCallback(async (enabled: boolean) => {
    if (!token || mutating.current) return;
    mutating.current = true;
    ++revision.current;
    setSaving(true);
    setError(null);
    try {
      if (enabled) {
        const Location = await import('expo-location');
        if (!mounted.current) return;
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!mounted.current) return;
        if (!permission.granted) {
          setPermissionRequired(true);
          throw new Error('Allow location access in your device settings before enabling phone location sharing.');
        }
        setPermissionRequired(false);
      }
      if (!mounted.current) return;
      const next = await driverApi.setLocationSharing(token, enabled);
      if (mounted.current) { setSettings(next); setLoading(false); }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Unable to save location settings.');
      throw e;
    } finally {
      mutating.current = false;
      if (mounted.current) setSaving(false);
    }
  }, [token]);

  // Foreground only. Never request permission or collect coordinates before opt-in.
  useEffect(() => {
    if (!token || !settings?.enabled || saving || !active) return;
    let cancelled = false;
    let reporting = false;
    async function report() {
      if (reporting || cancelled || mutating.current) return;
      reporting = true;
      try {
        const Location = await import('expo-location');
        const permission = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (!permission.granted) {
          setPermissionRequired(true);
          await setEnabled(false);
          return;
        }
        const point = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled || mutating.current || AppState.currentState !== 'active') return;
        const next = await driverApi.reportPhoneLocation(token!, {
          latitude: point.coords.latitude, longitude: point.coords.longitude,
          accuracy: point.coords.accuracy, observed_at: new Date(point.timestamp).toISOString(),
        });
        if (!cancelled) { setSettings(next); setPermissionRequired(false); setError(null); }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unable to share your phone location.');
          // Reconcile another device disabling sharing; the server rejects reports while off.
          void refresh();
        }
      } finally { reporting = false; }
    }
    void report();
    const timer = setInterval(() => { void report(); }, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [token, settings?.enabled, saving, active, refresh, setEnabled]);

  return <Context.Provider value={{ settings, loading, saving, error, permissionRequired, refresh, setEnabled }}>{children}</Context.Provider>;
}
export function usePhoneLocation() {
  const value = useContext(Context);
  if (!value) throw new Error('usePhoneLocation must be used within PhoneLocationProvider');
  return value;
}
