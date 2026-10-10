import * as Location from 'expo-location';

/** An on-demand foreground fix, independent of location reporting. */
export async function currentNavigationLocation(isCurrent: () => boolean, requestPermission = true) {
  let permission = await Location.getForegroundPermissionsAsync();
  if (!isCurrent()) throw new Error('Navigation cancelled.');
  if (permission.status !== 'granted' && requestPermission) permission = await Location.requestForegroundPermissionsAsync();
  if (!isCurrent()) throw new Error('Navigation cancelled.');
  if (permission.status !== 'granted') throw new Error('Allow phone location access to navigate.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const point = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Unable to get your current phone location. Try again.')), 20_000); }),
    ]);
    if (!isCurrent()) throw new Error('Navigation cancelled.');
    const { latitude, longitude } = point.coords;
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180
      || !Number.isFinite(point.timestamp) || Date.now() - point.timestamp > 30_000 || point.timestamp > Date.now() + 10_000) {
      throw new Error('A current phone location is unavailable. Try again.');
    }
    return { latitude, longitude, reportedAt: new Date(point.timestamp).toISOString() };
  } finally { if (timer) clearTimeout(timer); }
}
