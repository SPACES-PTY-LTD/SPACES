import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/component/ui/Text';
import { ApiRequestError, DeliveryOffer, DriverPresence, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

const ONLINE_STATUS_LOG_TAG = '[driver-online-status]';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
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
      console.warn(`${ONLINE_STATUS_LOG_TAG} toggle aborted: no session token`);
      return;
    }

    const nextOnline = !isOnline;
    setIsSyncing(true);

    try {
      console.log(`${ONLINE_STATUS_LOG_TAG} toggle started`, {
        currentOnline: isOnline,
        nextOnline,
        hasDeviceId: Boolean(deviceId),
      });
      const coords = nextOnline ? await getCurrentCoordinates() : null;
      console.log(`${ONLINE_STATUS_LOG_TAG} coordinates resolved`, {
        requested: nextOnline,
        hasCoordinates: Boolean(coords),
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      });

      const statusPayload = {
        is_available: nextOnline,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        platform: Platform.OS,
        user_device_id: deviceId ?? undefined,
      };
      console.log(`${ONLINE_STATUS_LOG_TAG} sending updateOnlineStatus`, statusPayload);

      const response = await driverApi.updateOnlineStatus(session.token, nextOnline, statusPayload);
      console.log(`${ONLINE_STATUS_LOG_TAG} updateOnlineStatus succeeded`, response);
      const lastSeenAt = response?.last_seen_at ?? null;
      setPresence((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          is_online: nextOnline,
          is_available: nextOnline,
          last_seen_at: lastSeenAt ?? current.last_seen_at,
          active_offers: nextOnline ? current.active_offers : [],
        };
      });
      setActiveOffers((current) => (nextOnline ? current : []));
      setIsOnline(nextOnline);
      setErrorMessage(null);
    } catch (error) {
      const requestError = error as ApiRequestError;
      console.error(`${ONLINE_STATUS_LOG_TAG} updateOnlineStatus failed`, {
        message: requestError.message,
        code: requestError.code,
        status: requestError.status,
        requestId: requestError.requestId,
        details: requestError.details,
      });
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
    <View className="flex-1 bg-background" id="main_container">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        <View className="bg-secondary rounded-xl px-6 pb-6 pt-6">

          <Text className="text-secondary-foreground mt-4 text-3xl font-semibold leading-tight">
            Welcome{user?.name ? `, ${user.name}` : ''}
          </Text>

          <View className="mt-3 py-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-secondary-foreground opacity-80 text-sm uppercase tracking-[2px]">Dispatch status</Text>
                <Text className="text-secondary-foreground mt-2 text-2xl font-semibold">{isOnline ? 'Online' : 'Offline'}</Text>
                <Text className="text-secondary-foreground opacity-80 mt-1 text-sm">
                  {presence?.last_seen_at ? `Last heartbeat: ${presence.last_seen_at}` : 'No heartbeat sent yet'}
                </Text>
              </View>
              <Pressable
                onPress={toggleOnline}
                disabled={isSyncing}
                className={`rounded-full px-5 py-3 ${isOnline ? 'bg-primary' : 'bg-card'}`}>
                <Text className={`text-sm font-semibold ${isOnline ? 'text-primary-foreground' : 'text-card-foreground'}`}>
                  {isSyncing ? 'Syncing...' : isOnline ? 'Go offline' : 'Go online'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {errorMessage ? (
          <View className="border-destructive bg-destructive mt-6 rounded-xl border px-5 py-5">
            <Text className="text-destructive-foreground text-base font-semibold">{errorMessage}</Text>
          </View>
        ) : null}

        <View className="bg-card mt-6 rounded-xl px-5 py-5">
          <Text className="text-card-foreground text-lg font-semibold">Active delivery offer</Text>
          {isSyncing && isOnline && !nextOffer ? (
            <View className="mt-4 items-center py-8">
              <ActivityIndicator color="#F54A4A" />
            </View>
          ) : nextOffer ? (
            <View className="bg-muted mt-4 rounded-[24px] px-4 py-4">
              <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">Offer #{nextOffer.sequence}</Text>
              <Text className="text-card-foreground mt-2 text-xl font-semibold">
                {nextOffer.shipment?.merchant_order_ref || nextOffer.shipment?.delivery_note_number || nextOffer.shipment_id}
              </Text>
              <Text className="text-muted-foreground mt-2 text-sm">
                Pickup: {nextOffer.shipment?.pickup_location?.full_address || 'Unknown'}
              </Text>
              <Text className="text-muted-foreground mt-1 text-sm">
                Dropoff: {nextOffer.shipment?.dropoff_location?.full_address || 'Unknown'}
              </Text>
              <Text className="text-muted-foreground mt-1 text-sm">Expires: {nextOffer.expires_at || 'Soon'}</Text>

              <View className="mt-4 flex-row gap-3">
                <Pressable
                  onPress={() => declineOffer(nextOffer)}
                  disabled={isMutatingOffer === nextOffer.offer_id}
                  className="bg-destructive flex-1 rounded-full px-4 py-4">
                  <Text className="text-destructive-foreground text-center text-base font-semibold">
                    {isMutatingOffer === nextOffer.offer_id ? 'Please wait...' : 'Decline'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => acceptOffer(nextOffer)}
                  disabled={isMutatingOffer === nextOffer.offer_id}
                  className="bg-secondary flex-1 rounded-full px-4 py-4">
                  <Text className="text-secondary-foreground text-center text-base font-semibold">
                    {isMutatingOffer === nextOffer.offer_id ? 'Please wait...' : 'Accept'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text className="text-muted-foreground mt-4 text-base leading-7">
              {isOnline
                ? 'No active offers right now. Heartbeats continue every 30 seconds while you stay online.'
                : 'Go online to become eligible for timed delivery offers.'}
            </Text>
          )}
        </View>

        
      </ScrollView>
    </View>
  );
}

async function getCurrentCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  const geolocation = globalThis.navigator?.geolocation;

  if (!geolocation) {
    console.warn(`${ONLINE_STATUS_LOG_TAG} geolocation unavailable on this device/runtime`);
    return null;
  }

  return await new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (position) => {
        console.log(`${ONLINE_STATUS_LOG_TAG} geolocation success`, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (geoError) => {
        console.warn(`${ONLINE_STATUS_LOG_TAG} geolocation failed`, {
          code: geoError.code,
          message: geoError.message,
        });
        resolve(null);
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
    );
  });
}
