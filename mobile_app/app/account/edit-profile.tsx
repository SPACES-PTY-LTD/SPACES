import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiRequestError, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, updateSessionUser } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const [name, setName] = useState(session?.user.name ?? '');
  const [telephone, setTelephone] = useState(session?.user.telephone ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSave = useMemo(() => {
    const nextName = name.trim();
    const currentName = session?.user.name ?? '';
    const currentTelephone = session?.user.telephone ?? '';
    const nextTelephone = telephone.trim();

    if (!nextName) {
      return false;
    }

    return nextName !== currentName || nextTelephone !== currentTelephone;
  }, [name, session?.user.name, session?.user.telephone, telephone]);

  async function handleSave() {
    if (!session?.token || !canSave) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await driverApi.updateProfile(session.token, {
        name: name.trim(),
        telephone: telephone.trim() ? telephone.trim() : null,
      });

      await updateSessionUser(response);
      setErrorMessage(null);
      router.back();
    } catch (error) {
      const requestError = error as ApiRequestError;
      setErrorMessage(requestError.message || 'Unable to update profile.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 8, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="bg-secondary rounded-xl px-6 py-6">
          <Text className="text-primary text-sm uppercase tracking-[3px]">Account</Text>
          <Text className="text-secondary-foreground mt-4 text-4xl font-semibold leading-tight">Edit profile</Text>
          <Text className="text-secondary-foreground mt-3 text-base leading-6 opacity-80">
            Update your driver profile details used by dispatch and support teams.
          </Text>
        </View>

        <View className="bg-card mt-6 rounded-xl px-5 py-5">
          <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={isDarkMode ? '#71717A' : '#A8A29E'}
            className="border-input-border bg-input text-input-foreground mt-2 rounded-xl border px-4 py-3 text-base"
          />

          <Text className="text-muted-foreground mt-5 text-sm uppercase tracking-[2px]">Telephone</Text>
          <TextInput
            value={telephone}
            onChangeText={setTelephone}
            placeholder="Telephone number"
            placeholderTextColor={isDarkMode ? '#71717A' : '#A8A29E'}
            keyboardType="phone-pad"
            className="border-input-border bg-input text-input-foreground mt-2 rounded-xl border px-4 py-3 text-base"
          />

          <Text className="text-muted-foreground mt-5 text-sm uppercase tracking-[2px]">Email</Text>
          <Text className="text-card-foreground mt-1 text-lg font-semibold">{session?.user.email ?? '-'}</Text>
        </View>

        {errorMessage ? (
          <View className="border-destructive bg-destructive mt-6 rounded-xl border px-5 py-5">
            <Text className="text-destructive-foreground text-base font-semibold">{errorMessage}</Text>
          </View>
        ) : null}

        <View className="mt-6 flex-row gap-3">
          <Pressable
            onPress={() => router.back()}
            className="bg-muted flex-1 items-center rounded-full px-6 py-4"
            disabled={isSaving}>
            <Text className="text-foreground text-base font-semibold">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={isSaving || !canSave}
            className={`flex-1 items-center rounded-full px-6 py-4 ${
              isSaving || !canSave ? 'bg-destructive' : 'bg-primary'
            }`}>
            {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-primary-foreground text-base font-semibold">Save</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
