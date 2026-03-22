import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/component/ui/Text';
import { ApiRequestError, DriverShipment, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

type ShipmentTab = 'active' | 'completed';

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const [shipments, setShipments] = useState<DriverShipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<ShipmentTab>('active');

  const loadShipments = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial', tab: ShipmentTab = selectedTab) => {
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
        const response = await driverApi.listShipments(session.token, {
          status: tab,
        });
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
    [selectedTab, session?.token],
  );

  useFocusEffect(
    useCallback(() => {
      loadShipments('initial', selectedTab);
    }, [loadShipments, selectedTab]),
  );

  const emptyStateTitle = selectedTab === 'completed' ? 'No completed shipments' : 'No active shipments';
  const emptyStateDescription =
    selectedTab === 'completed'
      ? 'Completed deliveries will appear here once they are marked delivered, failed, or cancelled.'
      : 'This driver does not have any current assignments yet.';

  function handleTabChange(tab: ShipmentTab) {
    if (tab === selectedTab) {
      return;
    }

    setSelectedTab(tab);
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 8, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadShipments('refresh', selectedTab)} />}
        showsVerticalScrollIndicator={false}>
        <View className="rounded-xl bg-secondary px-6 py-6">
          <Text className="text-primary text-sm uppercase tracking-[3px]">Shipments</Text>
          <Text className="text-secondary-foreground mt-4 text-4xl font-semibold leading-tight">Assigned deliveries</Text>
        </View>

        <View className="bg-card mt-5 flex-row items-center justify-start rounded-lg p-1">
          <TouchableOpacity
            onPress={() => handleTabChange('active')}
            className={`w-1/2 items-center justify-center rounded-lg p-3 ${selectedTab === 'active' ? 'bg-muted' : 'bg-transparent'}`}>
            <Text className={selectedTab === 'active' ? 'text-card-foreground font-semibold' : 'text-muted-foreground'}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleTabChange('completed')}
            className={`w-1/2 items-center justify-center rounded-lg p-3 ${selectedTab === 'completed' ? 'bg-muted' : 'bg-transparent'}`}>
            <Text className={selectedTab === 'completed' ? 'text-card-foreground font-semibold' : 'text-muted-foreground'}>Completed</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View className="bg-card mt-6 items-center rounded-xl px-5 py-12">
            <ActivityIndicator color="#F54A4A" />
          </View>
        ) : errorMessage ? (
          <View className="border-destructive bg-destructive mt-6 rounded-xl border px-5 py-5">
            <Text className="text-destructive-foreground text-base font-semibold">{errorMessage}</Text>
          </View>
        ) : shipments.length === 0 ? (
          <View className="bg-card mt-6 rounded-xl px-5 py-5">
            <Text className="text-card-foreground text-lg font-semibold">{emptyStateTitle}</Text>
            <Text className="text-muted-foreground mt-2 text-base leading-7">{emptyStateDescription}</Text>
          </View>
        ) : (
          <View className="mt-6 gap-4">
            {shipments.map((shipment) => (
              <Pressable
                key={shipment.shipment_id}
                className="bg-card rounded-xl px-5 py-5"
                onPress={() => router.push(`/shipments/${shipment.shipment_id}`)}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-card-foreground mt-2 text-xl font-semibold">
                      {shipment.merchant_order_ref || shipment.delivery_note_number || shipment.shipment_id}
                    </Text>
                    <Text className="text-muted-foreground mt-1 text-sm">
                      Carrier: {shipment.booking?.carrier_code || 'Unknown'}
                      {shipment.booking?.carrier_job_id ? ` • ${shipment.booking.carrier_job_id}` : ''}
                    </Text>
                  </View>
                  <View className="bg-accent rounded-full px-4 py-2">
                    <Text className="text-primary text-sm font-semibold uppercase">
                      {formatStatus(shipment.booking?.status || shipment.status)}
                    </Text>
                  </View>
                </View>

                <View className="bg-muted mt-5 rounded-[24px] px-4 py-4">
                  <View className="flex-row items-start gap-3">
                    <Feather name="map-pin" size={18} color="#F54A4A" style={{ marginTop: 2 }} />
                    <View className="flex-1">
                      <Text className="text-muted-foreground text-xs uppercase tracking-[2px]">Dropoff</Text>
                      <Text className="text-card-foreground mt-1 text-base font-medium">
                        {shipment.dropoff_location?.full_address || 'No dropoff address'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="mt-4 flex-row items-center justify-between">
                  <Text className="text-muted-foreground text-sm">
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
