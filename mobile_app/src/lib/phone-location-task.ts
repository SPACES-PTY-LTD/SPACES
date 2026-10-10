import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import type * as TaskManager from 'expo-task-manager';
import { driverApi, type SessionState } from './api';
import { readSession } from './auth-storage';
import { withPhoneLocationReport } from './phone-location-report';

export const PHONE_LOCATION_TASK = 'spaces-phone-location';
const CONSENT_KEY = 'spaces.phone-location.background-user';
// Older installed clients must retain foreground sharing until they are rebuilt.
const tasks: typeof TaskManager | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-task-manager');
  } catch { return null; }
})();
let operations: Promise<unknown> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const next = operations.then(operation, operation);
  operations = next.catch(() => {});
  return next;
}
export async function backgroundLocationAvailable() {
  return Platform.OS !== 'web' && !!tasks && await tasks.isAvailableAsync();
}
export function stopPhoneLocation() {
  return serialize(async () => {
    if (Platform.OS === 'web') return;
    // Revoke local reporting consent before any asynchronous native stop.
    await AsyncStorage.removeItem(CONSENT_KEY);
    if (await Location.hasStartedLocationUpdatesAsync(PHONE_LOCATION_TASK))
      await Location.stopLocationUpdatesAsync(PHONE_LOCATION_TASK);
  });
}
export function startPhoneLocation(userId: string) {
  return serialize(async () => {
    if (!await backgroundLocationAvailable()) throw Error('Install the updated app to share location in the background.');
    const permission = await Location.getBackgroundPermissionsAsync();
    if (!permission.granted) throw Error('Allow background location in device settings.');
    const started = await Location.hasStartedLocationUpdatesAsync(PHONE_LOCATION_TASK);
    let consent: { userId?: string; startedAt?: number } = {};
    try { consent = JSON.parse(await AsyncStorage.getItem(CONSENT_KEY) || '{}'); } catch {}
    if (!started || consent.userId !== userId)
      await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify({ userId, startedAt: Date.now() }));
    try {
      if (!started) {
        await Location.startLocationUpdatesAsync(PHONE_LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000,
          distanceInterval: 25,
          deferredUpdatesInterval: 30000,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Location sharing is on',
            notificationBody: 'Spaces Digital is sharing your location with dispatch.',
            killServiceOnDestroy: true,
          },
        });
      }
    } catch (error) {
      await AsyncStorage.removeItem(CONSENT_KEY);
      throw error;
    }
  });
}

// Loaded at module scope by the root provider, including headless task launches.
if (tasks && !tasks.isTaskDefined(PHONE_LOCATION_TASK)) {
  tasks.defineTask<{ locations: Location.LocationObject[] }>(PHONE_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const session = await readSession() as SessionState | null;
    const consent = await AsyncStorage.getItem(CONSENT_KEY);
    let owner: { userId?: string; startedAt?: number } = {};
    try { owner = JSON.parse(consent || '{}'); } catch {}
    if (!session || session.user.role !== 'driver' || owner.userId !== session.user.user_id) {
      await stopPhoneLocation(); return;
    }
    const point = data.locations.reduce((latest, item) => item.timestamp > latest.timestamp ? item : latest);
    if (!Number.isFinite(owner.startedAt) || point.timestamp < owner.startedAt! || !Number.isFinite(point.timestamp) || Math.abs(Date.now() - point.timestamp) > 5 * 60 * 1000) return;
    try {
      await withPhoneLocationReport(session.user.user_id, async () => {
        const settings = await driverApi.locationSharing(session.token);
        if (!settings.enabled) { await stopPhoneLocation(); return; }
        // A logout/disable while checking the server must prevent a new report.
        const current = await readSession() as SessionState | null;
        if (current?.token !== session.token || await AsyncStorage.getItem(CONSENT_KEY) !== consent) return;
        await driverApi.reportPhoneLocation(session.token, {
          latitude: point.coords.latitude, longitude: point.coords.longitude,
          accuracy: point.coords.accuracy, observed_at: new Date(point.timestamp).toISOString(),
        });
      });
    } catch (failure) {
      const status = (failure as { status?: number }).status;
      if (status === 401 || status === 403 || status === 409) await stopPhoneLocation();
      // Transient connectivity failures retry with the next native observation.
    }
  });
}
