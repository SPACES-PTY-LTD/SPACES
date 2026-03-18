import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SESSION_STORAGE_KEY = 'pickndrop.driver.session';
const memoryStorage = new Map<string, string>();

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

function getStorageAdapter(): StorageAdapter {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    return {
      getItem: async (key) => window.localStorage.getItem(key),
      setItem: async (key, value) => window.localStorage.setItem(key, value),
      removeItem: async (key) => window.localStorage.removeItem(key),
    };
  }

  const nativeStorage = AsyncStorage as typeof AsyncStorage | null;

  if (nativeStorage && typeof nativeStorage.getItem === 'function') {
    return {
      getItem: async (key) => {
        try {
          return await nativeStorage.getItem(key);
        } catch {
          return memoryStorage.get(key) ?? null;
        }
      },
      setItem: async (key, value) => {
        try {
          await nativeStorage.setItem(key, value);
        } catch {
          memoryStorage.set(key, value);
        }
      },
      removeItem: async (key) => {
        try {
          await nativeStorage.removeItem(key);
        } catch {
          memoryStorage.delete(key);
        }
      },
    };
  }

  return {
    getItem: async (key) => memoryStorage.get(key) ?? null,
    setItem: async (key, value) => {
      memoryStorage.set(key, value);
    },
    removeItem: async (key) => {
      memoryStorage.delete(key);
    },
  };
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
