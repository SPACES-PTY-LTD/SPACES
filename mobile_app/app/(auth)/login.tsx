import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { ApiRequestError } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

export default function LoginScreen() {
  const { isHydrating, session, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isHydrating) {
    return (
      <View className="flex-1 items-center justify-center bg-[#111111]">
        <ActivityIndicator color="#F54A4A" size="large" />
      </View>
    );
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-[#F3EFE7]">
      <View className="flex-1 justify-between px-6 pb-8 pt-20">
        <View>
          <View className="mb-10 rounded-[32px] bg-[#111111] px-6 py-8">
            <Text className="text-sm uppercase tracking-[3px] text-[#F54A4A]">Pick n Drop Driver</Text>
            <Text className="mt-4 text-4xl font-semibold leading-tight text-white">
              Sign in to start your route.
            </Text>
            <Text className="mt-3 text-base leading-6 text-[#C8C8C8]">
              Use your driver account from the Laravel backend. Only driver profiles can access this app.
            </Text>
          </View>

          <View className="gap-4">
            <View>
              <Text className="mb-2 text-sm font-medium uppercase tracking-[2px] text-[#57534E]">Email</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="driver@pickndrop.test"
                placeholderTextColor="#A8A29E"
                value={email}
                className="rounded-[22px] border border-[#D6D3D1] bg-white px-5 py-4 text-base text-[#111111]"
              />
            </View>

            <View>
              <Text className="mb-2 text-sm font-medium uppercase tracking-[2px] text-[#57534E]">Password</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#A8A29E"
                secureTextEntry
                value={password}
                className="rounded-[22px] border border-[#D6D3D1] bg-white px-5 py-4 text-base text-[#111111]"
              />
            </View>

            {errorMessages.length > 0 ? (
              <View className="rounded-[20px] border border-[#FECACA] bg-[#FEE2E2] px-4 py-3">
                {errorMessages.map((message) => (
                  <Text key={message} className="text-sm text-[#991B1B]">
                    {message}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View>
          <Pressable
            disabled={isSubmitting}
            onPress={handleSubmit}
            className={`items-center rounded-full px-6 py-4 ${isSubmitting ? 'bg-[#FCA5A5]' : 'bg-[#F54A4A]'}`}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-white">Log in</Text>
            )}
          </Pressable>

          <Link href="/(auth)/register" asChild>
            <Pressable className="mt-4 items-center py-3">
              <Text className="text-sm text-[#57534E]">Need access? Registration is not available in-app yet.</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
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
