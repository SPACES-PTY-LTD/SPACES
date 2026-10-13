import { Feather } from '@expo/vector-icons';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Redirect } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BottomSheet } from '@/component/ui/BottomSheet';
import { BrandLoadingScreen } from '@/src/components/BrandLoadingScreen';
import { ApiRequestError, authApi } from '@/src/lib/api';
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
  const [merchants, setMerchants] = useState<{ merchant_id: string; name: string }[] | null>(null);
  const [merchantId, setMerchantId] = useState('');
  const [isMerchantOpen, setIsMerchantOpen] = useState(false);
  const requestVersion = useRef(0);
  const submitting = useRef(false);

  const changeEmail = (value: string) => {
    requestVersion.current += 1;
    setEmail(value);
    setMerchants(null);
    setMerchantId('');
    setIsMerchantOpen(false);
    setPassword('');
    setIsPasswordVisible(false);
    setErrorMessages([]);
  };

  if (isHydrating) {
    return <BrandLoadingScreen />;
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  const handleSubmit = async () => {
    if (submitting.current) return;
    const version = requestVersion.current;
    const normalizedEmail = email.trim();
    setErrorMessages([]);
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorMessages(['Enter a valid email address.']);
      return;
    }
    if (merchants && !merchantId) {
      setErrorMessages(['Select a merchant to continue.']);
      return;
    }
    if (merchants && !password) {
      setErrorMessages(['Enter your password.']);
      return;
    }
    submitting.current = true;
    setIsSubmitting(true);

    try {
      if (!merchants) {
        const result = await authApi.driverMerchants(normalizedEmail);
        if (version !== requestVersion.current) return;
        if (!result.merchants.length) {
          setErrorMessages(['No active driver merchants found. Contact your dispatcher for access.']);
          return;
        }
        setMerchants(result.merchants);
        setMerchantId(result.merchants.length === 1 ? result.merchants[0].merchant_id : '');
      } else {
        await signIn({ email: normalizedEmail, password, merchant_id: merchantId });
      }
    } catch (error) {
      if (version === requestVersion.current) setErrorMessages(getLoginErrors(error));
    } finally {
      submitting.current = false;
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
          <View style={[styles.mapHero, { height: (width - insets.left - insets.right) * 180 / 390 + insets.top }]} accessible={false} importantForAccessibility="no-hide-descendants">
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
                accessibilityLabel="Email" autoComplete="email" onChangeText={changeEmail} value={email} style={inputStyle}
                editable={!isSubmitting} returnKeyType="next" onSubmitEditing={merchants ? undefined : handleSubmit} />
            </View>
            {merchants && merchants.length > 1 ? (
              <View>
                <Text style={[styles.label, { color: ink }]}>Merchant</Text>
                <Pressable disabled={isSubmitting} onPress={() => { Keyboard.dismiss(); setIsMerchantOpen(true); }}
                  accessibilityRole="button" accessibilityLabel="Select merchant" accessibilityState={{ expanded: isMerchantOpen, disabled: isSubmitting }}
                  accessibilityValue={{ text: merchants.find((merchant) => merchant.merchant_id === merchantId)?.name || 'Select a merchant' }}
                  style={[inputStyle, styles.merchantTrigger]}>
                  <Text style={{ color: ink, flex: 1 }}>{merchants.find((merchant) => merchant.merchant_id === merchantId)?.name || 'Select a merchant'}</Text>
                  <Feather name={isMerchantOpen ? 'chevron-up' : 'chevron-down'} size={20} color={muted} />
                </Pressable>
              </View>
            ) : null}
            {merchantId ? <View>
              <Text style={[styles.label, { color: ink }]}>Password</Text>
              <View style={styles.passwordField}>
                <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setPassword}
                  accessibilityLabel="Password" autoComplete="current-password" secureTextEntry={!isPasswordVisible}
                  value={password} style={[inputStyle, styles.passwordInput]} editable={!isSubmitting}
                  returnKeyType="go" onSubmitEditing={handleSubmit} />
                <Pressable onPress={() => setIsPasswordVisible((visible) => !visible)} accessibilityRole="button"
                  accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'} style={styles.passwordToggle}>
                  <Feather name={isPasswordVisible ? 'eye-off' : 'eye'} size={20} color={muted} />
                </Pressable>
              </View>
            </View> : null}
            {errorMessages.length > 0 ? (
              <View accessibilityLiveRegion="polite" style={[styles.error, { backgroundColor: isDarkMode ? '#451a03' : '#fef3c7' }]}>
                {errorMessages.map((message) => <Text key={message} style={{ color: isDarkMode ? '#fde68a' : '#92400e', fontSize: 14 }}>{message}</Text>)}
              </View>
            ) : null}

          </View>

          <View style={styles.footer}>
            <Pressable disabled={isSubmitting || (!!merchants && !merchantId)} onPress={handleSubmit} accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting || (!!merchants && !merchantId), busy: isSubmitting }}
              style={[styles.submit, { opacity: isSubmitting || (!!merchants && !merchantId) ? 0.6 : 1 }]}>
              {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{merchantId ? 'Log in' : 'Continue'}</Text>}
            </Pressable>
            <Text style={[styles.support, { color: muted }]}>Need access? Contact your dispatcher.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {isMerchantOpen && merchants ? <MerchantSelectionSheet merchants={merchants} selectedId={merchantId}
        onDismiss={() => setIsMerchantOpen(false)}
        onSelect={(id) => { setMerchantId(id); setPassword(''); setIsPasswordVisible(false); setErrorMessages([]); }} /> : null}
    </SafeAreaView>
  );
}

function MerchantSelectionSheet({ merchants, selectedId, onSelect, onDismiss }: {
  merchants: { merchant_id: string; name: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDismiss: () => void;
}) {
  const modal = useRef<BottomSheetModal>(null);
  const pending = useRef<string | null>(null);
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  useEffect(() => {
    const frame = requestAnimationFrame(() => modal.current?.present());
    const selection = pending;
    return () => { cancelAnimationFrame(frame); selection.current = null; };
  }, []);

  return <BottomSheet modalRef={modal} title="Select a merchant" scrollable contentPanning={false}
    onDismiss={() => {
      const id = pending.current;
      pending.current = null;
      onDismiss();
      if (id && merchants.some((merchant) => merchant.merchant_id === id)) onSelect(id);
    }}>
    {merchants.map((merchant) => <Pressable key={merchant.merchant_id}
      accessibilityRole="radio" accessibilityLabel={merchant.name} accessibilityState={{ checked: selectedId === merchant.merchant_id }}
      onPress={() => { if (pending.current) return; pending.current = merchant.merchant_id; modal.current?.dismiss(); }}
      style={[styles.merchantOption, { backgroundColor: dark ? '#27272a' : '#f5f5f8' }]}>
      <Text style={{ color: dark ? '#fafafa' : '#102b42', flex: 1, fontSize: 16 }}>{merchant.name}</Text>
      {selectedId === merchant.merchant_id ? <Feather name="check" size={20} color={dark ? '#86efac' : '#15803d'} /> : null}
    </Pressable>)}
  </BottomSheet>;
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
  merchantTrigger: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  merchantOption: { minHeight: 56, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  passwordInput: { paddingRight: 64 },
  passwordToggle: { position: 'absolute', right: 8, top: 0, bottom: 0, width: 48, alignItems: 'center', justifyContent: 'center' },
  error: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  submit: { alignItems: 'center', justifyContent: 'center', minHeight: 56, borderRadius: 18, backgroundColor: '#15803d', paddingHorizontal: 24, paddingVertical: 16 },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  footer: { flexShrink: 0, marginTop: 'auto', paddingHorizontal: 28, gap: 20, paddingBottom: 16 },
  support: { fontSize: 13, lineHeight: 16, textAlign: 'center' },
});
