import { useSyncExternalStore } from 'react';
import { colorScheme as nativeWindColorScheme, useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { useThemePreference } from '@/src/lib/theme-preference';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const { colorScheme, setColorScheme, toggleColorScheme } = useNativeWindColorScheme();
  const preference = useThemePreference();

  if (hasHydrated) {
    return {
      colorScheme: preference === 'system' ? colorScheme ?? 'light' : preference,
      setColorScheme,
      toggleColorScheme,
    };
  }

  return {
    colorScheme: 'light' as const,
    setColorScheme,
    toggleColorScheme,
  };
}

export const colorScheme = nativeWindColorScheme;
