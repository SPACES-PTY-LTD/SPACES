import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiRequestError, DriverVehicle, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

export default function VehicleDetailScreen() {
  const { vehicle_id } = useLocalSearchParams<{ vehicle_id: string }>();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<DriverVehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadVehicle() {
      if (!session?.token || !vehicle_id) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await driverApi.getVehicle(session.token, vehicle_id);
        setVehicle(response);
        setErrorMessage(null);
      } catch (error) {
        const requestError = error as ApiRequestError;
        setErrorMessage(requestError.message || 'Unable to load vehicle.');
      } finally {
        setIsLoading(false);
      }
    }

    loadVehicle();
  }, [session?.token, vehicle_id]);

  return (
    <View className="flex-1 bg-[#F3EFE7]">
      <Stack.Screen options={{ headerShown: false }} />

      <Pressable
        onPress={() => router.back()}
        className="absolute left-5 z-20 h-12 w-12 items-center justify-center rounded-full bg-white"
        style={{ top: insets.top + 10 }}>
        <Feather name="chevron-left" size={24} color="#111111" />
      </Pressable>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 72, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        <View className="rounded-[32px] bg-[#111111] px-6 py-6">
          <Text className="text-sm uppercase tracking-[3px] text-[#F54A4A]">Vehicle detail</Text>
          <Text className="mt-4 text-3xl font-semibold leading-tight text-white">
            {vehicle?.plate_number || vehicle?.ref_code || vehicle_id}
          </Text>
          <Text className="mt-3 text-base leading-6 text-[#C8C8C8]">
            {vehicle?.make || 'Unknown make'} {vehicle?.model || ''}
          </Text>
        </View>

        {isLoading ? (
          <View className="mt-6 items-center rounded-[28px] bg-white px-5 py-12">
            <ActivityIndicator color="#F54A4A" />
          </View>
        ) : errorMessage ? (
          <View className="mt-6 rounded-[28px] border border-[#FECACA] bg-[#FEE2E2] px-5 py-5">
            <Text className="text-base font-semibold text-[#991B1B]">{errorMessage}</Text>
          </View>
        ) : vehicle ? (
          <View className="mt-6 rounded-[28px] bg-white px-5 py-5">
            <InfoRow label="Plate number" value={vehicle.plate_number} />
            <InfoRow label="Reference code" value={vehicle.ref_code} />
            <InfoRow label="Year" value={vehicle.year ? String(vehicle.year) : null} />
            <InfoRow label="Color" value={vehicle.color} />
            <InfoRow label="VIN" value={vehicle.vin_number} />
            <InfoRow label="Engine number" value={vehicle.engine_number} />
            <InfoRow label="Odometer" value={vehicle.odometer ? String(vehicle.odometer) : null} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="mt-4 flex-row justify-between gap-4">
      <Text className="flex-1 text-sm uppercase tracking-[2px] text-[#78716C]">{label}</Text>
      <Text className="flex-1 text-right text-base font-medium text-[#111111]">{value || 'Not available'}</Text>
    </View>
  );
}
