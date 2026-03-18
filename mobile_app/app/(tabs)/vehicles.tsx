import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiRequestError, DriverVehicle, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

export default function VehiclesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const [vehicles, setVehicles] = useState<DriverVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadVehicles = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!session?.token) {
        setVehicles([]);
        setIsLoading(false);
        return;
      }

      if (mode === 'refresh') {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const response = await driverApi.listVehicles(session.token);
        setVehicles(response.data);
        setErrorMessage(null);
      } catch (error) {
        const requestError = error as ApiRequestError;
        setErrorMessage(requestError.message || 'Unable to load vehicles.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [session?.token],
  );

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [loadVehicles]),
  );

  return (
    <View className="flex-1 bg-[#F3EFE7]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 8, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadVehicles('refresh')} />}
        showsVerticalScrollIndicator={false}>
        <View className="rounded-[32px] bg-[#111111] px-6 py-6">
          <Text className="text-sm uppercase tracking-[3px] text-[#F54A4A]">Vehicles</Text>
          <Text className="mt-4 text-4xl font-semibold leading-tight text-white">Assigned fleet</Text>
          <Text className="mt-3 text-base leading-6 text-[#C8C8C8]">
            Vehicles available to this driver from `/driver/vehicles`.
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
        ) : vehicles.length === 0 ? (
          <View className="mt-6 rounded-[28px] bg-white px-5 py-5">
            <Text className="text-lg font-semibold text-[#111111]">No assigned vehicles</Text>
            <Text className="mt-2 text-base leading-7 text-[#57534E]">
              Vehicle assignments will appear here once they are linked to the driver.
            </Text>
          </View>
        ) : (
          <View className="mt-6 gap-4">
            {vehicles.map((vehicle) => (
              <Pressable
                key={vehicle.vehicle_id}
                className="rounded-[28px] bg-white px-5 py-5"
                onPress={() => router.push(`/vehicles/${vehicle.vehicle_id}`)}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-sm uppercase tracking-[2px] text-[#78716C]">
                      {vehicle.make || 'Unknown make'} {vehicle.model || ''}
                    </Text>
                    <Text className="mt-2 text-2xl font-semibold text-[#111111]">
                      {vehicle.plate_number || vehicle.ref_code || 'Unregistered vehicle'}
                    </Text>
                  </View>
                  <View className={`rounded-full px-4 py-2 ${vehicle.is_active ? 'bg-[#DCFCE7]' : 'bg-[#E7E5E4]'}`}>
                    <Text className={`text-sm font-semibold uppercase ${vehicle.is_active ? 'text-[#166534]' : 'text-[#57534E]'}`}>
                      {vehicle.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                <View className="mt-5 rounded-[24px] bg-[#F5F5F4] px-4 py-4">
                  <InfoLine icon="hash" label="Reference" value={vehicle.ref_code || 'No ref code'} />
                  <InfoLine icon="map-pin" label="Last seen" value={vehicle.last_location_address || 'No location update'} />
                  <InfoLine icon="clock" label="Updated" value={vehicle.location_updated_at || 'Unknown'} />
                </View>

                <View className="mt-4 flex-row items-center justify-between">
                  <Text className="text-sm text-[#57534E]">Odometer: {vehicle.odometer ?? 'N/A'}</Text>
                  <Feather name="chevron-right" size={24} color="#A8A29E" />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InfoLine({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View className="mt-3 flex-row items-start gap-3 first:mt-0">
      <Feather name={icon} size={16} color="#F54A4A" style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="text-xs uppercase tracking-[2px] text-[#A8A29E]">{label}</Text>
        <Text className="mt-1 text-base font-medium text-[#111111]">{value}</Text>
      </View>
    </View>
  );
}
