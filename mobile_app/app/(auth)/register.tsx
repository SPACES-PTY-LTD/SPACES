import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function RegisterScreen() {
  return (
    <View className="flex-1 bg-[#F3EFE7] px-6 pb-8 pt-20">
      <View className="rounded-[32px] bg-[#111111] px-6 py-8">
        <Text className="text-sm uppercase tracking-[3px] text-[#F54A4A]">Driver Access</Text>
        <Text className="mt-4 text-4xl font-semibold leading-tight text-white">
          Driver self-registration is disabled.
        </Text>
        <Text className="mt-3 text-base leading-6 text-[#C8C8C8]">
          Driver accounts are currently created in the Laravel admin workflow. Ask dispatch or an administrator to provision your account.
        </Text>
      </View>

      <View className="mt-6 rounded-[28px] bg-white px-5 py-6">
        <Text className="text-base leading-7 text-[#44403C]">
          Once your account exists, come back to the login screen and sign in with the email address assigned to your driver profile.
        </Text>
      </View>

      <Link href="/(auth)/login" asChild>
        <Pressable className="mt-auto items-center rounded-full bg-[#F54A4A] px-6 py-4">
          <Text className="text-base font-semibold text-white">Back to login</Text>
        </Pressable>
      </Link>
    </View>
  );
}
