import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';
import { useSyncExternalStore } from 'react';

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
    if (version === revision && (stored === 'light' || stored === 'dark' || stored === 'system')) apply(stored);
  } catch { /* Retain the current preference when storage is unavailable. */ }
}
export async function setThemePreference(next: ThemePreference) {
  ++revision;
  await AsyncStorage.setItem(key, next);
  apply(next);
}
export function useThemePreference() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => preference, () => 'light' as ThemePreference);
}
