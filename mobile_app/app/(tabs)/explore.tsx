import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/src/providers/auth-provider';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = async () => {
    setIsSubmitting(true);

    try {
      await signOut();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F3EFE7]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        <View className="rounded-[32px] bg-[#111111] px-6 py-6">
          <Text className="text-sm uppercase tracking-[3px] text-[#F54A4A]">Account</Text>
          <Text className="mt-4 text-4xl font-semibold leading-tight text-white">
            {session?.user.name ?? 'Driver account'}
          </Text>
          <Text className="mt-3 text-base leading-6 text-[#C8C8C8]">
            This screen holds session details for now. More driver-specific settings can be added here later.
          </Text>
        </View>

        <View className="mt-6 rounded-[28px] bg-white px-5 py-5">
          <Text className="text-sm uppercase tracking-[2px] text-[#78716C]">Email</Text>
          <Text className="mt-1 text-lg font-semibold text-[#111111]">{session?.user.email}</Text>

          <Text className="mt-5 text-sm uppercase tracking-[2px] text-[#78716C]">Role</Text>
          <Text className="mt-1 text-lg font-semibold capitalize text-[#111111]">{session?.user.role}</Text>

          <Text className="mt-5 text-sm uppercase tracking-[2px] text-[#78716C]">Last login</Text>
          <Text className="mt-1 text-lg font-semibold text-[#111111]">
            {session?.user.last_login_at ?? 'Unavailable'}
          </Text>
        </View>

        <Pressable
          disabled={isSubmitting}
          onPress={handleLogout}
          className={`mt-6 items-center rounded-full px-6 py-4 ${isSubmitting ? 'bg-[#FCA5A5]' : 'bg-[#F54A4A]'}`}>
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-white">Log out</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}
