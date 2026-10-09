import "@/global.css";

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, DefaultTheme, ThemeProvider, Redirect, Stack, useRootNavigationState, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { colorScheme as appColorScheme, useColorScheme } from '@/hooks/use-color-scheme';
import { BrandLoadingScreen } from '@/src/components/BrandLoadingScreen';
import { MessageNotifications } from '@/src/providers/message-notifications';
import { AuthProvider, useAuth } from '@/src/providers/auth-provider';
import { PhoneLocationProvider } from '@/src/providers/phone-location-provider';
import { restoreThemePreference } from '@/src/lib/theme-preference';

// Start in light mode; the in-app theme toggle can still change it afterwards.
appColorScheme.set('light');

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  useEffect(() => { void restoreThemePreference(); }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <BottomSheetModalProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <LocationSession><RootNavigator /></LocationSession>
            <MessageNotifications />
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          </ThemeProvider>
        </BottomSheetModalProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function LocationSession({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  return <PhoneLocationProvider key={session?.token ?? 'signed-out'}>{children}</PhoneLocationProvider>;
}

function RootNavigator() {
  const { isHydrating, session } = useAuth();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key || isHydrating) {
      return;
    }
  }, [isHydrating, navigationState?.key]);

  if (isHydrating || !navigationState?.key) {
    return <BrandLoadingScreen />;
  }

  const inAuthGroup = segments[0] === '(auth)';

  if (!session && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  if (session && inAuthGroup) {
    return <Redirect href="/(tabs)" />;
  }

  return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="shipments/load" options={{ presentation: 'transparentModal', animation: 'none', gestureEnabled: false, contentStyle: { backgroundColor: 'transparent' } }} />
        <Stack.Screen name="shipments/imports/[import_id]" options={{ presentation: 'transparentModal', animation: 'none', gestureEnabled: false, contentStyle: { backgroundColor: 'transparent' } }} />
        <Stack.Screen name="runs/[run_id]" />
        <Stack.Screen name="bookings" />
        <Stack.Screen name="shipments/[shipment_id]" />
        <Stack.Screen name="shipments/[shipment_id]/scan" />
        <Stack.Screen name="shipments/completed" />
        <Stack.Screen name="account/edit-profile" />
        <Stack.Screen name="account/vehicles" />
        <Stack.Screen name="vehicles/[vehicle_id]" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
  );
}
