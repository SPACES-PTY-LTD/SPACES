import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/component/ui/Text';

export default function RegisterScreen() {
  return (
    <View className="flex-1 bg-background px-6 pb-8 pt-20">
      <View className="bg-secondary rounded-xl px-6 py-8">
        <Text className="text-primary text-sm uppercase tracking-[3px]">Driver Access</Text>
        <Text className="text-secondary-foreground mt-4 text-4xl font-semibold leading-tight">
          Driver self-registration is disabled.
        </Text>
        <Text className="text-secondary-foreground mt-3 text-base leading-6 opacity-80">
          Driver accounts are currently created in the Laravel admin workflow. Ask dispatch or an administrator to provision your account.
        </Text>
      </View>

      <View className="bg-card mt-6 rounded-xl px-5 py-6">
        <Text className="text-muted-foreground text-base leading-7">
          Once your account exists, come back to the login screen and sign in with the email address assigned to your driver profile.
        </Text>
      </View>

      <Link href="/(auth)/login" asChild>
        <Pressable className="bg-primary mt-auto items-center rounded-full px-6 py-4">
          <Text className="text-primary-foreground text-base font-semibold">Back to login</Text>
        </Pressable>
      </Link>
    </View>
  );
}
