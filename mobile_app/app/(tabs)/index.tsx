import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiRequestError, DeliveryOffer, DriverPresence, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { apiBaseUrl, environmentName, session } = useAuth();
  const user = session?.user;
  const [presence, setPresence] = useState<DriverPresence | null>(null);
  const [activeOffers, setActiveOffers] = useState<DeliveryOffer[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMutatingOffer, setIsMutatingOffer] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    let isMounted = true;

    async function registerDevice() {
      try {
        const response = await driverApi.registerDevice(session.token, {
          platform: Platform.OS,
        });

        if (!isMounted) {
          return;
        }

        setDeviceId(response.user_device_id);
      } catch {
        // Device registration is best-effort for now.
      }
    }

    registerDevice();

    return () => {
      isMounted = false;
    };
  }, [session?.token]);

  useEffect(() => {
    if (!session?.token || !isOnline) {
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    async function sendHeartbeat() {
      setIsSyncing(true);

      try {
        const coords = await getCurrentCoordinates();
        const response = await driverApi.heartbeat(session.token, {
          is_online: true,
          is_available: true,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          platform: Platform.OS,
          user_device_id: deviceId ?? undefined,
        });

        if (cancelled) {
          return;
        }

        setPresence(response);
        setActiveOffers(response.active_offers || []);
        setErrorMessage(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const requestError = error as ApiRequestError;
        setErrorMessage(requestError.message || 'Unable to update driver presence.');
      } finally {
        if (!cancelled) {
          setIsSyncing(false);
        }
      }
    }

    sendHeartbeat();
    intervalId = setInterval(sendHeartbeat, 30000);

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [deviceId, isOnline, session?.token]);

  const nextOffer = useMemo(() => activeOffers[0] ?? null, [activeOffers]);

  async function toggleOnline() {
    if (!session?.token) {
      return;
    }

    const nextOnline = !isOnline;
    setIsSyncing(true);

    try {
      const response = await driverApi.updateOnlineStatus(session.token, nextOnline);
      setPresence(response);
      setActiveOffers(nextOnline ? response.active_offers || [] : []);
      setIsOnline(nextOnline);
      setErrorMessage(null);
    } catch (error) {
      const requestError = error as ApiRequestError;
      setErrorMessage(requestError.message || 'Unable to update online status.');
    } finally {
      setIsSyncing(false);
    }
  }

  async function acceptOffer(offer: DeliveryOffer) {
    if (!session?.token) {
      return;
    }

    setIsMutatingOffer(offer.offer_id);
    try {
      const response = await driverApi.acceptOffer(session.token, offer.offer_id);
      setActiveOffers((current) => current.filter((item) => item.offer_id !== offer.offer_id));
      router.push(`/shipments/${response.shipment.shipment_id}`);
      setErrorMessage(null);
    } catch (error) {
      const requestError = error as ApiRequestError;
      setErrorMessage(requestError.message || 'Unable to accept delivery offer.');
    } finally {
      setIsMutatingOffer(null);
    }
  }

  async function declineOffer(offer: DeliveryOffer) {
    if (!session?.token) {
      return;
    }

    setIsMutatingOffer(offer.offer_id);
    try {
      const response = await driverApi.declineOffer(session.token, offer.offer_id);
      setActiveOffers((current) => {
        const remaining = current.filter((item) => item.offer_id !== offer.offer_id);
        return response.next_offer ? [response.next_offer, ...remaining] : remaining;
      });
      setErrorMessage(null);
    } catch (error) {
      const requestError = error as ApiRequestError;
      setErrorMessage(requestError.message || 'Unable to decline delivery offer.');
    } finally {
      setIsMutatingOffer(null);
    }
  }

  return (
    <View className="flex-1 bg-[#F3EFE7]" id="main_container">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        <View className="rounded-[32px] bg-[#111111] px-6 pb-6 pt-6">
          <Text className="text-sm uppercase tracking-[3px] text-[#F54A4A]">Driver Dashboard</Text>
          <Text className="mt-4 text-4xl font-semibold leading-tight text-white">
            Welcome back{user?.name ? `, ${user.name}` : ''}.
          </Text>
          <Text className="mt-3 text-base leading-6 text-[#C8C8C8]">
            Go online to receive timed delivery offers and keep this screen open so presence heartbeats stay active.
          </Text>

          <View className="mt-8 flex-row gap-3">
            <View className="flex-1 rounded-[24px] bg-[#1C1C1F] px-4 py-4">
              <Text className="text-sm uppercase tracking-[2px] text-[#A1A1AA]">Role</Text>
              <Text className="mt-3 text-2xl font-semibold text-white">{user?.role ?? 'driver'}</Text>
            </View>
            <View className="flex-1 rounded-[24px] bg-[#1C1C1F] px-4 py-4">
              <Text className="text-sm uppercase tracking-[2px] text-[#A1A1AA]">Environment</Text>
              <Text className="mt-3 text-2xl font-semibold capitalize text-white">{environmentName}</Text>
            </View>
          </View>

          <View className="mt-6 rounded-[24px] bg-[#1C1C1F] px-4 py-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm uppercase tracking-[2px] text-[#A1A1AA]">Dispatch status</Text>
                <Text className="mt-2 text-2xl font-semibold text-white">{isOnline ? 'Online' : 'Offline'}</Text>
                <Text className="mt-1 text-sm text-[#C8C8C8]">
                  {presence?.last_seen_at ? `Last heartbeat: ${presence.last_seen_at}` : 'No heartbeat sent yet'}
                </Text>
              </View>
              <Pressable
                onPress={toggleOnline}
                disabled={isSyncing}
                className={`rounded-full px-5 py-3 ${isOnline ? 'bg-[#F54A4A]' : 'bg-white'}`}>
                <Text className={`text-sm font-semibold ${isOnline ? 'text-white' : 'text-[#111111]'}`}>
                  {isSyncing ? 'Syncing...' : isOnline ? 'Go offline' : 'Go online'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {errorMessage ? (
          <View className="mt-6 rounded-[28px] border border-[#FECACA] bg-[#FEE2E2] px-5 py-5">
            <Text className="text-base font-semibold text-[#991B1B]">{errorMessage}</Text>
          </View>
        ) : null}

        <View className="mt-6 rounded-[28px] bg-white px-5 py-5">
          <Text className="text-lg font-semibold text-[#111111]">Active delivery offer</Text>
          {isSyncing && isOnline && !nextOffer ? (
            <View className="mt-4 items-center py-8">
              <ActivityIndicator color="#F54A4A" />
            </View>
          ) : nextOffer ? (
            <View className="mt-4 rounded-[24px] bg-[#F5F5F4] px-4 py-4">
              <Text className="text-sm uppercase tracking-[2px] text-[#78716C]">Offer #{nextOffer.sequence}</Text>
              <Text className="mt-2 text-xl font-semibold text-[#111111]">
                {nextOffer.shipment?.merchant_order_ref || nextOffer.shipment?.delivery_note_number || nextOffer.shipment_id}
              </Text>
              <Text className="mt-2 text-sm text-[#57534E]">
                Pickup: {nextOffer.shipment?.pickup_location?.full_address || 'Unknown'}
              </Text>
              <Text className="mt-1 text-sm text-[#57534E]">
                Dropoff: {nextOffer.shipment?.dropoff_location?.full_address || 'Unknown'}
              </Text>
              <Text className="mt-1 text-sm text-[#57534E]">Expires: {nextOffer.expires_at || 'Soon'}</Text>

              <View className="mt-4 flex-row gap-3">
                <Pressable
                  onPress={() => declineOffer(nextOffer)}
                  disabled={isMutatingOffer === nextOffer.offer_id}
                  className="flex-1 rounded-full bg-[#FEE2E2] px-4 py-4">
                  <Text className="text-center text-base font-semibold text-[#B91C1C]">
                    {isMutatingOffer === nextOffer.offer_id ? 'Please wait...' : 'Decline'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => acceptOffer(nextOffer)}
                  disabled={isMutatingOffer === nextOffer.offer_id}
                  className="flex-1 rounded-full bg-[#111111] px-4 py-4">
                  <Text className="text-center text-base font-semibold text-white">
                    {isMutatingOffer === nextOffer.offer_id ? 'Please wait...' : 'Accept'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text className="mt-4 text-base leading-7 text-[#57534E]">
              {isOnline
                ? 'No active offers right now. Heartbeats continue every 30 seconds while you stay online.'
                : 'Go online to become eligible for timed delivery offers.'}
            </Text>
          )}
        </View>

        <View className="mt-6 rounded-[28px] bg-white px-5 py-5">
          <Text className="text-lg font-semibold text-[#111111]">Session details</Text>

          <View className="mt-4 gap-4">
            <View className="flex-row items-start gap-3">
              <View className="mt-1 h-10 w-10 items-center justify-center rounded-full bg-[#FDE8E8]">
                <Feather name="user" size={18} color="#F54A4A" />
              </View>
              <View className="flex-1">
                <Text className="text-sm uppercase tracking-[2px] text-[#78716C]">Driver name</Text>
                <Text className="mt-1 text-lg font-semibold text-[#111111]">{user?.name ?? 'Not loaded'}</Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <View className="mt-1 h-10 w-10 items-center justify-center rounded-full bg-[#FDE8E8]">
                <Feather name="mail" size={18} color="#F54A4A" />
              </View>
              <View className="flex-1">
                <Text className="text-sm uppercase tracking-[2px] text-[#78716C]">Email</Text>
                <Text className="mt-1 text-lg font-semibold text-[#111111]">{user?.email ?? 'Not loaded'}</Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <View className="mt-1 h-10 w-10 items-center justify-center rounded-full bg-[#FDE8E8]">
                <Feather name="smartphone" size={18} color="#F54A4A" />
              </View>
              <View className="flex-1">
                <Text className="text-sm uppercase tracking-[2px] text-[#78716C]">Registered device</Text>
                <Text className="mt-1 text-base font-semibold text-[#111111]">{deviceId ?? 'Pending registration'}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

async function getCurrentCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  const geolocation = globalThis.navigator?.geolocation;

  if (!geolocation) {
    return null;
  }

  return await new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
    );
  });
}
