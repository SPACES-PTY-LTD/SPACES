import { Feather, Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ShipmentCompletedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notes, setNotes] = useState('');

  return (
    <View className="flex-1 bg-[#ECEDEE]">
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mb-6 h-12 w-12 items-center justify-center rounded-full bg-white">
          <Feather name="chevron-left" size={24} color="#111" />
        </TouchableOpacity>

        <View className="mb-8 items-center rounded-[28px] bg-[#DDE0E2] px-6 py-8">
          <View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-[#35BE64]">
            <Ionicons name="checkmark-done" size={48} color="#fff" />
          </View>
          <Text className="text-3xl font-bold text-[#111]">Order Completed</Text>
          <Text className="mt-2 text-center text-base text-[#6B6E73]">
            Delivery has been confirmed. Add proof of delivery and optional notes below.
          </Text>
        </View>

        <View className="mb-5 rounded-[24px] bg-[#DDE0E2] p-5">
          <Text className="mb-3 text-lg font-semibold text-[#111]">POD Picture</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            className="items-center rounded-[20px] border-2 border-dashed border-[#B8BBBF] bg-[#ECEDEE] px-5 py-8">
            <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-[#111]">
              <Feather name="camera" size={24} color="#fff" />
            </View>
            <Text className="text-base font-semibold text-[#111]">Add POD picture</Text>
            <Text className="mt-1 text-sm text-[#72767B]">Tap to attach a delivery photo</Text>
          </TouchableOpacity>
        </View>

        <View className="mb-8 rounded-[24px] bg-[#DDE0E2] p-5">
          <Text className="mb-3 text-lg font-semibold text-[#111]">Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
            placeholder="Add any notes about the delivery"
            placeholderTextColor="#8A8E93"
            className="min-h-32 rounded-[16px] bg-[#ECEDEE] px-4 py-4 text-base text-[#111]"
          />
        </View>

        <TouchableOpacity
          onPress={() => router.replace('/')}
          className="h-16 items-center justify-center rounded-full bg-black">
          <Text className="text-lg font-semibold text-white">Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
