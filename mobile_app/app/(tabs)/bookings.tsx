import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiRequestError, DriverShipment, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const [shipments, setShipments] = useState<DriverShipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadShipments = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!session?.token) {
        setShipments([]);
        setIsLoading(false);
        return;
      }

      if (mode === 'refresh') {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const response = await driverApi.listShipments(session.token);
        setShipments(response.data);
        setErrorMessage(null);
      } catch (error) {
        const requestError = error as ApiRequestError;
        setErrorMessage(requestError.message || 'Unable to load shipments.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [session?.token],
  );

  useFocusEffect(
    useCallback(() => {
      loadShipments();
    }, [loadShipments]),
  );

  return (
    <View className="flex-1 bg-[#F3EFE7]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 8, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadBookings('refresh')} />}
        showsVerticalScrollIndicator={false}>
        <View className="rounded-[32px] bg-[#111111] px-6 py-6">
          <Text className="text-sm uppercase tracking-[3px] text-[#F54A4A]">Shipments</Text>
          <Text className="mt-4 text-4xl font-semibold leading-tight text-white">Assigned deliveries</Text>
          <Text className="mt-3 text-base leading-6 text-[#C8C8C8]">
            Live assignments from `/driver/shipments` for the logged-in driver.
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
        ) : shipments.length === 0 ? (
          <View className="mt-6 rounded-[28px] bg-white px-5 py-5">
            <Text className="text-lg font-semibold text-[#111111]">No active shipments</Text>
            <Text className="mt-2 text-base leading-7 text-[#57534E]">
              This driver does not have any current assignments yet.
            </Text>
          </View>
        ) : (
          <View className="mt-6 gap-4">
            {shipments.map((shipment) => (
              <Pressable
                key={shipment.shipment_id}
                className="rounded-[28px] bg-white px-5 py-5"
                onPress={() => router.push(`/shipments/${shipment.shipment_id}`)}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-sm uppercase tracking-[2px] text-[#78716C]">{shipment.booking?.status || shipment.status}</Text>
                    <Text className="mt-2 text-xl font-semibold text-[#111111]">
                      {shipment.merchant_order_ref || shipment.delivery_note_number || shipment.shipment_id}
                    </Text>
                    <Text className="mt-1 text-sm text-[#57534E]">
                      Carrier: {shipment.booking?.carrier_code || 'Unknown'}
                      {shipment.booking?.carrier_job_id ? ` • ${shipment.booking.carrier_job_id}` : ''}
                    </Text>
                  </View>
                  <View className="rounded-full bg-[#FDE8E8] px-4 py-2">
                    <Text className="text-sm font-semibold uppercase text-[#F54A4A]">
                      {formatStatus(shipment.booking?.status || shipment.status)}
                    </Text>
                  </View>
                </View>

                <View className="mt-5 rounded-[24px] bg-[#F5F5F4] px-4 py-4">
                  <View className="flex-row items-start gap-3">
                    <Feather name="map-pin" size={18} color="#F54A4A" style={{ marginTop: 2 }} />
                    <View className="flex-1">
                      <Text className="text-xs uppercase tracking-[2px] text-[#A8A29E]">Dropoff</Text>
                      <Text className="mt-1 text-base font-medium text-[#111111]">
                        {shipment.dropoff_location?.full_address || 'No dropoff address'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="mt-4 flex-row items-center justify-between">
                  <Text className="text-sm text-[#57534E]">
                    Ready: {shipment.ready_at || shipment.booking?.booked_at || 'Unscheduled'}
                  </Text>
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

function formatStatus(status: string) {
  return status.replaceAll('_', ' ');
}
