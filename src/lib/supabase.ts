import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { getSupabaseConfig } from '@/lib/env';
import {
  clearLegacyNativeSession,
  nativeSessionStorage,
} from '@/lib/nativeSessionStorage';
import type { Database } from '@/types/database';

export type BackendClient = SupabaseClient<Database>;
let client: BackendClient | undefined;

export async function getBackendClient(): Promise<BackendClient | undefined> {
  const config = getSupabaseConfig();
  if (!config) return undefined;
  if (client) return client;
  if (Platform.OS !== 'web') await clearLegacyNativeSession(config.url);
  client ??= createClient<Database>(config.url, config.publishableKey, {
    auth: {
      ...(Platform.OS !== 'web' && { storage: nativeSessionStorage }),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export function createRecoveryClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error('A Supabase project is required.');
  return createClient<Database>(config.url, config.publishableKey, {
    auth: {
      storageKey: 'familyroots-recovery',
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function refreshSessionInForeground(backend: BackendClient) {
  if (Platform.OS === 'web') return undefined;
  const sync = (state: string | null) => {
    if (state === 'active') void backend.auth.startAutoRefresh();
    else void backend.auth.stopAutoRefresh();
  };
  sync(AppState.currentState);
  const subscription = AppState.addEventListener('change', sync);
  return () => {
    subscription.remove();
    void backend.auth.stopAutoRefresh();
  };
}
