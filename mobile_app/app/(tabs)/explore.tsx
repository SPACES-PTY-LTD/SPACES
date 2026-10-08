import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/component/ui/Text';
import { PageHeader } from '@/component/ui/PageHeader';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/src/providers/auth-provider';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDarkMode = colorScheme === 'dark';

  const handleLogout = async () => {
    setIsSubmitting(true);

    try {
      await signOut();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-[#111111]" style={{ paddingTop: insets.top }}>
      <PageHeader title="Account" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        <View className="rounded-xl bg-[#F5F5F8] dark:bg-card px-5 py-5">
          <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">Name</Text>
          <Text className="text-card-foreground mt-1 text-lg font-semibold">{session?.user.name ?? 'Driver account'}</Text>
          <Text className="text-muted-foreground mt-5 text-sm uppercase tracking-[2px]">Email</Text>
          <Text className="text-card-foreground mt-1 text-lg font-semibold">{session?.user.email}</Text>

          <Text className="text-muted-foreground mt-5 text-sm uppercase tracking-[2px]">Telephone</Text>
          <Text className="text-card-foreground mt-1 text-lg font-semibold">{session?.user.telephone || 'Not set'}</Text>

          <Text className="text-muted-foreground mt-5 text-sm uppercase tracking-[2px]">Role</Text>
          <Text className="text-card-foreground mt-1 text-lg font-semibold capitalize">{session?.user.role}</Text>
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push('/account/vehicles')}
          className="border-border bg-[#F5F5F8] dark:bg-card mt-6 rounded-xl border px-5 py-4">
          <Text className="text-card-foreground text-lg font-semibold">Vehicles assigned to me</Text>
          <Text className="text-muted-foreground mt-1">View your assigned vehicles and their details.</Text>
        </Pressable>

        <Pressable
          onPress={toggleColorScheme}
          className="border-border bg-[#F5F5F8] dark:bg-card mt-6 rounded-xl border px-5 py-4">
          <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">Theme</Text>
          <Text className="text-card-foreground mt-2 text-lg font-semibold">
            {isDarkMode ? 'Dark mode' : 'Light mode'}
          </Text>
          <Text className="text-muted-foreground mt-1 text-sm">
            Tap to switch to {isDarkMode ? 'light' : 'dark'} mode.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/account/edit-profile')}
          className="bg-secondary mt-6 items-center rounded-full px-6 py-4">
          <Text className="text-secondary-foreground text-base font-semibold">Edit profile</Text>
        </Pressable>

        <Pressable
          disabled={isSubmitting}
          onPress={handleLogout}
          className={`mt-6 items-center rounded-full px-6 py-4 ${isSubmitting ? 'bg-destructive' : 'bg-primary'}`}>
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-primary-foreground text-base font-semibold">Log out</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}
