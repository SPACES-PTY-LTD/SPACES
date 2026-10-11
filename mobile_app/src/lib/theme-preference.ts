import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme, useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { AppState } from 'react-native';
import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
const key = 'spaces.theme-preference';
let preference: ThemePreference = 'light';
let revision = 0;
const listeners = new Set<() => void>();
function apply(next: ThemePreference) {
  preference = next;
  colorScheme.set(next);
  listeners.forEach(listener => listener());
}
export async function restoreThemePreference() {
  const version = revision;
  try {
    const stored = await AsyncStorage.getItem(key);
    if (version === revision) apply(stored === 'light' || stored === 'dark' || stored === 'system' ? stored : preference);
  } catch { /* Retain the current preference when storage is unavailable. */ }
}
export async function setThemePreference(next: ThemePreference) {
  const version = ++revision;
  await AsyncStorage.setItem(key, next);
  if (version === revision) apply(next);
}
export function useThemePreference() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => preference, () => 'light' as ThemePreference);
}


/** Keep utility styles and native appearance aligned with the saved app preference. */
export function useThemeSynchronization() {
  const selected = useThemePreference();
  const { colorScheme: observed } = useNativeWindColorScheme();
  useLayoutEffect(() => {
    if (selected !== 'system' && observed !== selected) colorScheme.set(selected);
  }, [selected, observed]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      // Native appearance may change while an OS picker/modal is open or the app is backgrounded.
      if (state === 'active') colorScheme.set(preference);
    });
    return () => subscription.remove();
  }, []);
}
