import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

const SESSION_STORAGE_KEY = 'pickndrop.driver.session';
const memoryStorage = new Map<string, string>();
let nativeStorageDisabled = false;
let cachedStorageAdapter: StorageAdapter | null = null;

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

function getStorageAdapter(): StorageAdapter {
  if (cachedStorageAdapter) {
    return cachedStorageAdapter;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    cachedStorageAdapter = {
      getItem: async (key) => window.localStorage.getItem(key),
      setItem: async (key, value) => window.localStorage.setItem(key, value),
      removeItem: async (key) => window.localStorage.removeItem(key),
    };
    return cachedStorageAdapter;
  }

  if (nativeStorageDisabled) {
    cachedStorageAdapter = {
      getItem: async (key) => memoryStorage.get(key) ?? null,
      setItem: async (key, value) => {
        memoryStorage.set(key, value);
      },
      removeItem: async (key) => {
        memoryStorage.delete(key);
      },
    };
    return cachedStorageAdapter;
  }

  const nativeStorage = AsyncStorage as typeof AsyncStorage | null;
  const hasNativeBinding = Boolean(
    (NativeModules as Record<string, unknown>)?.RNCAsyncStorage ||
      (NativeModules as Record<string, unknown>)?.AsyncSQLiteDBStorage
  );

  if (hasNativeBinding && nativeStorage && typeof nativeStorage.getItem === 'function') {
    cachedStorageAdapter = {
      getItem: async (key) => {
        try {
          return await nativeStorage.getItem(key);
        } catch (error) {
          if (error instanceof Error && error.message.includes('Native module is null')) {
            nativeStorageDisabled = true;
            cachedStorageAdapter = null;
          }
          return memoryStorage.get(key) ?? null;
        }
      },
      setItem: async (key, value) => {
        try {
          await nativeStorage.setItem(key, value);
        } catch (error) {
          if (error instanceof Error && error.message.includes('Native module is null')) {
            nativeStorageDisabled = true;
            cachedStorageAdapter = null;
          }
          memoryStorage.set(key, value);
        }
      },
      removeItem: async (key) => {
        try {
          await nativeStorage.removeItem(key);
        } catch (error) {
          if (error instanceof Error && error.message.includes('Native module is null')) {
            nativeStorageDisabled = true;
            cachedStorageAdapter = null;
          }
          memoryStorage.delete(key);
        }
      },
    };
    return cachedStorageAdapter;
  }

  cachedStorageAdapter = {
    getItem: async (key) => memoryStorage.get(key) ?? null,
    setItem: async (key, value) => {
      memoryStorage.set(key, value);
    },
    removeItem: async (key) => {
      memoryStorage.delete(key);
    },
  };
  return cachedStorageAdapter;
}

export async function readSession() {
  const rawValue = await getStorageAdapter().getItem(SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    await getStorageAdapter().removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export async function writeSession(value: unknown) {
  await getStorageAdapter().setItem(SESSION_STORAGE_KEY, JSON.stringify(value));
}

export async function clearSession() {
  await getStorageAdapter().removeItem(SESSION_STORAGE_KEY);
}
