import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { driverApi, type PhoneLocationSettings } from '@/src/lib/api';
import { backgroundLocationAvailable, startPhoneLocation, stopPhoneLocation } from '@/src/lib/phone-location-task';
import { useAuth } from './auth-provider';
import { withPhoneLocationReport } from '@/src/lib/phone-location-report';

type LocationContextValue = {
  settings: PhoneLocationSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  permissionRequired: boolean;
  backgroundGranted: boolean;
  refresh: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
};
const Context = createContext<LocationContextValue | null>(null);

export function PhoneLocationProvider({ children }: { children: ReactNode }) {
  const { session, isHydrating } = useAuth();
  const token = session?.token;
  const userId = session?.user.user_id;
  const [savedSettings, setSettings] = useState<PhoneLocationSettings | null>(null);
  const [settingsToken, setSettingsToken] = useState<string>();
  const settings = settingsToken === token ? savedSettings : null;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionRequired, setPermissionRequired] = useState(false);
  const [backgroundGranted, setBackgroundGranted] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const mutating = useRef(false);
  const mounted = useRef(true);
  const revision = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => { revision.current++; }, [token]);

  const refresh = useCallback(async () => {
    if (!token || mutating.current) return;
    const version = ++revision.current;
    try {
      const next = await driverApi.locationSharing(token);
      if (!mounted.current || version !== revision.current) return;
      setSettingsToken(token);
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
    const version = ++revision.current;
    setSaving(true);
    setError(null);
    try {
      if (enabled) {
        const Location = await import('expo-location');
        if (!mounted.current || version !== revision.current) return;
        if (!await backgroundLocationAvailable()) throw new Error('Install the updated app to share location in the background.');
        if (!mounted.current || version !== revision.current) return;
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!mounted.current || version !== revision.current) return;
        if (!permission.granted) {
          setPermissionRequired(true);
          throw new Error('Allow location access in your device settings before enabling phone location sharing.');
        }
        const background = await Location.requestBackgroundPermissionsAsync();
        if (!mounted.current || version !== revision.current) return;
        setBackgroundGranted(background.granted);
        setPermissionRequired(!background.granted);
        if (!background.granted) throw new Error('Choose Always on iOS or Allow all the time on Android in device settings to share location in the background.');
      } else {
        await stopPhoneLocation();
      }
      if (!mounted.current || version !== revision.current) return;
      const next = await driverApi.setLocationSharing(token, enabled);
      if (mounted.current && version === revision.current) { setSettingsToken(token); setSettings(next); setLoading(false); }
    } catch (e) {
      if (mounted.current && version === revision.current) setError(e instanceof Error ? e.message : 'Unable to save location settings.');
      throw e;
    } finally {
      mutating.current = false;
      if (mounted.current) setSaving(false);
    }
  }, [token]);

  // Resume an existing opt-in without silently prompting for broader access.
  useEffect(() => {
    let cancelled = false;
    async function sync() {
      try {
        if (isHydrating) return;
        if (!token || !settings?.enabled) {
          await stopPhoneLocation();
          if (!cancelled) setBackgroundGranted(false);
          return;
        }
        if (saving || !active) return;
        const Location = await import('expo-location');
        const permission = await Location.getBackgroundPermissionsAsync();
        const available = await backgroundLocationAvailable();
        if (cancelled) return;
        setBackgroundGranted(permission.granted && available);
        if (permission.granted && available) await startPhoneLocation(session!.user.user_id);
        else await stopPhoneLocation();
      } catch (failure) {
        if (!cancelled) { setBackgroundGranted(false); setError(failure instanceof Error ? failure.message : 'Unable to start background sharing.'); }
      }
    }
    void sync();
    return () => { cancelled = true; };
  }, [token, session, isHydrating, settings, saving, active]);

  // Foreground feedback/fallback; the native task continues when inactive.
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
        const next = await withPhoneLocationReport(userId!, async () => {
          // The persisted cooldown check yields; recheck cancellation before sending.
          if (cancelled || mutating.current || AppState.currentState !== 'active') return null;
          return driverApi.reportPhoneLocation(token!, {
            latitude: point.coords.latitude, longitude: point.coords.longitude,
            accuracy: point.coords.accuracy, observed_at: new Date(point.timestamp).toISOString(),
          });
        });
        if (!cancelled && next) { setSettings(next); setPermissionRequired(false); setError(null); }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unable to share your phone location.');
          // Reconcile another device disabling sharing; the server rejects reports while off.
          if ((e as { status?: number }).status !== 429) void refresh();
        }
      } finally { reporting = false; }
    }
    void report();
    const timer = setInterval(() => { void report(); }, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [token, userId, settings?.enabled, saving, active, refresh, setEnabled]);

  return <Context.Provider value={{ settings, loading, saving, error, permissionRequired, backgroundGranted, refresh, setEnabled }}>{children}</Context.Provider>;
}
export function usePhoneLocation() {
  const value = useContext(Context);
  if (!value) throw new Error('usePhoneLocation must be used within PhoneLocationProvider');
  return value;
}
