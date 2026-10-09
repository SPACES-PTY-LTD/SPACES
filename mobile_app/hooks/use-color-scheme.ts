import { colorScheme as nativeWindColorScheme, useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { useThemePreference } from '@/src/lib/theme-preference';

export function useColorScheme() {
  const { colorScheme, setColorScheme, toggleColorScheme } = useNativeWindColorScheme();
  const preference = useThemePreference();

  return {
    colorScheme: preference === 'system' ? colorScheme ?? 'light' : preference,
    setColorScheme,
    toggleColorScheme,
  };
}

export const colorScheme = nativeWindColorScheme;
