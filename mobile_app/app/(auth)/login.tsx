import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';

import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiRequestError } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

export default function LoginScreen() {
  const { isHydrating, session, signIn } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isHydrating) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
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
      className="flex-1 bg-background">
      <View className="flex-1 justify-between px-6 pb-8 pt-20">
        <View>
          
          <Text className="text-muted-foreground text-center text-sm font-semibold uppercase tracking-[3px]">{process.env.NEXT_PUBLIC_APP_NAME ?? "Spaces Digital"}</Text>
          <Text className="text-foreground mt-4 text-center text-4xl font-semibold leading-tight">
            Sign in
          </Text>
          

          <View className="gap-4">
            <View>
              <Text className="text-muted-foreground mb-2 text-sm font-medium uppercase tracking-[2px]">Email</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="driver@pickndrop.test"
                placeholderTextColor={isDarkMode ? '#71717A' : '#A8A29E'}
                value={email}
                className="border-input-border bg-input text-input-foreground rounded-[22px] border px-5 py-4 text-base"
              />
            </View>

            <View>
              <Text className="text-muted-foreground mb-2 text-sm font-medium uppercase tracking-[2px]">Password</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={isDarkMode ? '#71717A' : '#A8A29E'}
                secureTextEntry
                value={password}
                className="border-input-border bg-input text-input-foreground rounded-[22px] border px-5 py-4 text-base"
              />
            </View>

            {errorMessages.length > 0 ? (
              <View className="border-destructive bg-destructive rounded-[20px] border px-4 py-3">
                {errorMessages.map((message) => (
                  <Text key={message} className="text-destructive-foreground text-sm">
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
            className={`items-center rounded-full px-6 py-4 ${isSubmitting ? 'bg-destructive' : 'bg-primary'}`}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-primary-foreground text-base font-semibold">Log in</Text>
            )}
          </Pressable>

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
