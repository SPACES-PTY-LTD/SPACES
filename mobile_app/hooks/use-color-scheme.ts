import { colorScheme as nativeWindColorScheme, useColorScheme as useNativeWindColorScheme } from 'nativewind';

export function useColorScheme() {
  const { colorScheme, setColorScheme, toggleColorScheme } = useNativeWindColorScheme();

  return {
    colorScheme: colorScheme ?? 'light',
    setColorScheme,
    toggleColorScheme,
  };
}

export const colorScheme = nativeWindColorScheme;
