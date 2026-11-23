import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { createChunkedStorage } from '@/lib/chunkedStorage';

const options = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const nativeSessionStorage = createChunkedStorage({
  getItem: (key) => SecureStore.getItemAsync(key, options),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
  removeItem: (key) => SecureStore.deleteItemAsync(key, options),
});

export async function clearLegacyNativeSession(url: string) {
  const key = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  await AsyncStorage.multiRemove([key, `${key}-code-verifier`, `${key}-user`]);
}
