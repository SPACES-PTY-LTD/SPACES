import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ApiRequestError } from './api';

const REPORT_INTERVAL_MS = 30_000;
const DEFAULT_RETRY_MS = 60_000;
const inFlight = new Set<string>();

// Both native callbacks and foreground reports use this persisted per-driver gate.
// Keep deadlines across task/React restarts; never store bearer tokens or coordinates.
export async function withPhoneLocationReport<T>(userId: string, report: () => Promise<T>): Promise<T | null> {
  if (inFlight.has(userId)) return null;
  inFlight.add(userId);
  const key = `spaces.phone-location.next-report.${userId}`;
  try {
    const deadline = Number(await AsyncStorage.getItem(key));
    if (Number.isFinite(deadline) && deadline > Date.now()) return null;
    await AsyncStorage.setItem(key, String(Date.now() + REPORT_INTERVAL_MS));
    try {
      return await report();
    } catch (failure) {
      const error = failure as ApiRequestError;
      if (error?.status === 429) {
        const retry = typeof error.retryAfterMs === 'number' && Number.isFinite(error.retryAfterMs)
          ? Math.max(REPORT_INTERVAL_MS, error.retryAfterMs) : DEFAULT_RETRY_MS;
        await AsyncStorage.setItem(key, String(Date.now() + retry));
      }
      throw failure;
    }
  } finally {
    inFlight.delete(userId);
  }
}
