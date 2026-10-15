import "@/global.css";

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { StartupUpdateGate } from '@/src/components/StartupUpdateGate';
import { BrandLoadingScreen } from '@/src/components/BrandLoadingScreen';
import { MessageNotifications } from '@/src/providers/message-notifications';
import { AuthProvider, useAuth } from '@/src/providers/auth-provider';
import { GuidanceProvider } from '@/src/navigation/GuidanceProvider';
import { PhoneLocationProvider } from '@/src/providers/phone-location-provider';
import { restoreThemePreference, useThemeSynchronization } from '@/src/lib/theme-preference';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  useThemeSynchronization();
  const { colorScheme } = useColorScheme();
  useEffect(() => { void restoreThemePreference(); }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StartupUpdateGate>
        <AuthProvider>
          <BottomSheetModalProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <GuidanceProvider><LocationSession><RootNavigator /></LocationSession></GuidanceProvider>
              <MessageNotifications />
              <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            </ThemeProvider>
          </BottomSheetModalProvider>
        </AuthProvider>
      </StartupUpdateGate>
    </GestureHandlerRootView>
  );
}

function LocationSession({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  return <PhoneLocationProvider key={session?.token ?? 'signed-out'}>{children}</PhoneLocationProvider>;
}

function RootNavigator() {
  const { isHydrating, session } = useAuth();
  if (isHydrating) {
    return <BrandLoadingScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/register" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
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
        <Stack.Screen name="account/notifications" />
        <Stack.Screen name="account/theme" />
        <Stack.Screen name="account/location" />
        <Stack.Screen name="vehicles/[vehicle_id]" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack.Protected>
    </Stack>
  );
}
