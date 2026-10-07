import { Feather } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BrandLoadingScreen } from '@/src/components/BrandLoadingScreen';
import { ApiRequestError } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

export default function LoginScreen() {
  const { isHydrating, session, signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const background = isDarkMode ? '#09090b' : '#ffffff';
  const ink = isDarkMode ? '#ffffff' : '#102b42';
  const muted = isDarkMode ? '#d4d4d8' : '#71717a';
  const inputStyle = [styles.input, { color: ink, backgroundColor: isDarkMode ? '#111111' : '#ffffff', borderColor: isDarkMode ? '#27272a' : '#dadcd8' }];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isHydrating) {
    return <BrandLoadingScreen />;
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  const handleSubmit = async () => {
    setErrorMessages([]);
    setIsSubmitting(true);

    try {
      await signIn({
        email: email.trim(),
        password,
      });
    } catch (error) {
      setErrorMessages(getLoginErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.fill, { backgroundColor: background }]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.fill}>
        <ScrollView style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustContentInsets={false}>
          <View style={[styles.mapHero, { height: (width - insets.left - insets.right) * 273 / 390 + insets.top }]} accessible={false} importantForAccessibility="no-hide-descendants">
            <Image source={require('@/assets/images/login/on-the-move-map.svg')} style={styles.mapArtwork} contentFit="cover" />
            <View style={[styles.brandChip, { top: insets.top + 18 }]}>
              <Image source={require('@/assets/branding/destination.svg')} style={styles.brandMark} contentFit="contain" />
              <Text style={styles.brand}>Spaces Digital</Text>
            </View>
          </View>
          <View style={styles.form}>
            <Text style={[styles.title, { color: ink }]}>{'Ready for your\nnext move?'}</Text>
            <Text style={[styles.subtitle, { color: muted }]}>Sign in to your driver account.</Text>
            <View>
              <Text style={[styles.label, { color: ink }]}>Email</Text>
              <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
                accessibilityLabel="Email" autoComplete="email" onChangeText={setEmail} value={email} style={inputStyle} />
            </View>
            <View>
              <Text style={[styles.label, { color: ink }]}>Password</Text>
              <View style={styles.passwordField}>
                <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setPassword}
                  accessibilityLabel="Password" autoComplete="current-password" secureTextEntry={!isPasswordVisible}
                  value={password} style={[inputStyle, styles.passwordInput]} />
                <Pressable onPress={() => setIsPasswordVisible((visible) => !visible)} accessibilityRole="button"
                  accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'} style={styles.passwordToggle}>
                  <Feather name={isPasswordVisible ? 'eye-off' : 'eye'} size={20} color={muted} />
                </Pressable>
              </View>
            </View>
            {errorMessages.length > 0 ? (
              <View accessibilityLiveRegion="polite" style={[styles.error, { backgroundColor: isDarkMode ? '#7f1d1d' : '#fee2e2' }]}>
                {errorMessages.map((message) => <Text key={message} style={{ color: isDarkMode ? '#fecaca' : '#991b1b', fontSize: 14 }}>{message}</Text>)}
              </View>
            ) : null}

          </View>

          <View style={styles.footer}>
            <Pressable disabled={isSubmitting} onPress={handleSubmit} accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
              style={[styles.submit, { opacity: isSubmitting ? 0.6 : 1 }]}>
              {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Log in</Text>}
            </Pressable>
            <Text style={[styles.support, { color: muted }]}>Need access? Contact your dispatcher.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getLoginErrors(error: unknown) {
  if (!(error instanceof Error)) {
    return ['Unable to sign in.'];
  }

  const apiError = error as ApiRequestError;
  const detailMessages = apiError.details
    ? Object.values(apiError.details).flat().filter(Boolean)
    : [];

  if (detailMessages.length > 0) {
    return detailMessages;
  }

  return [apiError.message];
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1 },
  mapHero: { width: '100%', backgroundColor: '#e5eff9', overflow: 'hidden' },
  mapArtwork: { width: '100%', height: '100%' },
  brandChip: { position: 'absolute', left: 24, top: 18, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: '#ffffff' },
  brandMark: { width: 26, height: 26 },
  brand: { fontSize: 17, fontWeight: '600', color: '#315f4a' },
  form: { paddingHorizontal: 28, paddingTop: 26, paddingBottom: 24, gap: 20 },
  title: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  subtitle: { fontSize: 16, lineHeight: 20 },
  label: { marginBottom: 8, fontSize: 14, lineHeight: 17, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, minHeight: 56, fontSize: 16 },
  passwordField: { position: 'relative' },
  passwordInput: { paddingRight: 64 },
  passwordToggle: { position: 'absolute', right: 8, top: 0, bottom: 0, width: 48, alignItems: 'center', justifyContent: 'center' },
  error: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  submit: { alignItems: 'center', justifyContent: 'center', minHeight: 56, borderRadius: 18, backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 16 },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  footer: { flexShrink: 0, marginTop: 'auto', paddingHorizontal: 28, gap: 20, paddingBottom: 16 },
  support: { fontSize: 13, lineHeight: 16, textAlign: 'center' },
});
