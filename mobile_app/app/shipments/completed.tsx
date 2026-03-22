import { Feather, Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ShipmentCompletedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const [notes, setNotes] = useState('');

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-card mb-6 h-12 w-12 items-center justify-center rounded-full">
          <Feather name="chevron-left" size={24} color={isDarkMode ? '#FFFFFF' : '#111111'} />
        </TouchableOpacity>

        <View className="bg-card mb-8 items-center rounded-xl px-6 py-8">
          <View className="bg-success mb-4 h-24 w-24 items-center justify-center rounded-full">
            <Ionicons name="checkmark-done" size={48} color="#fff" />
          </View>
          <Text className="text-card-foreground text-3xl font-bold">Order Completed</Text>
          <Text className="text-muted-foreground mt-2 text-center text-base">
            Delivery has been confirmed. Add proof of delivery and optional notes below.
          </Text>
        </View>

        <View className="bg-card mb-5 rounded-[24px] p-5">
          <Text className="text-card-foreground mb-3 text-lg font-semibold">POD Picture</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            className="border-border bg-muted items-center rounded-[20px] border-2 border-dashed px-5 py-8">
            <View className="bg-secondary mb-3 h-14 w-14 items-center justify-center rounded-full">
              <Feather name="camera" size={24} color="#fff" />
            </View>
            <Text className="text-card-foreground text-base font-semibold">Add POD picture</Text>
            <Text className="text-muted-foreground mt-1 text-sm">Tap to attach a delivery photo</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-card mb-8 rounded-[24px] p-5">
          <Text className="text-card-foreground mb-3 text-lg font-semibold">Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
            placeholder="Add any notes about the delivery"
            placeholderTextColor={isDarkMode ? '#71717A' : '#8A8E93'}
            className="bg-input text-input-foreground min-h-32 rounded-[16px] px-4 py-4 text-base"
          />
        </View>

        <TouchableOpacity
          onPress={() => router.replace('/')}
          className="bg-secondary h-16 items-center justify-center rounded-full">
          <Text className="text-secondary-foreground text-lg font-semibold">Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
