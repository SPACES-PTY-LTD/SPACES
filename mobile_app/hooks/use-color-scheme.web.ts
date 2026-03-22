import { useEffect, useState } from 'react';
import { colorScheme as nativeWindColorScheme, useColorScheme as useNativeWindColorScheme } from 'nativewind';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const { colorScheme, setColorScheme, toggleColorScheme } = useNativeWindColorScheme();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (hasHydrated) {
    return {
      colorScheme: colorScheme ?? 'light',
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
