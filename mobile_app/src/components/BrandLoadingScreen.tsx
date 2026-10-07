import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function BrandLoadingScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Image
        source={require('@/assets/branding/splash.png')}
        contentFit="contain"
        accessibilityLabel="Spaces Digital"
        style={styles.logo}
      />
      <ActivityIndicator color="#315f4a" size="small" accessibilityLabel="Loading" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32, backgroundColor: '#ffffff' },
  logo: { width: 200, height: 260 },
});
