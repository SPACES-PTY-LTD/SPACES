import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { BrandLoadingScreen } from './BrandLoadingScreen';
import { startStartupUpdate } from '@/src/lib/startup-update';

const enabled = !__DEV__ && Platform.OS !== 'web' && Updates.isEnabled;

/** Runs once per cold launch, before navigation, forms or uploads can mount. */
export function StartupUpdateGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!enabled);
  useEffect(() => {
    if (!enabled) return;
    const update = startStartupUpdate(Updates, () => setReady(true));
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') update.skip();
    });
    if (AppState.currentState !== 'active') update.skip();
    return () => { update.dispose(); subscription.remove(); };
  }, []);

  if (ready) return children;
  return <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
    <BrandLoadingScreen />
    <Text accessibilityLiveRegion="polite" style={{ textAlign: 'center', color: '#315f4a', paddingBottom: 48 }}>Checking for updates…</Text>
  </View>;
}
