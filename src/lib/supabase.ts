import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { getSupabaseConfig } from '@/lib/env';
import type { Database } from '@/types/database';

export type BackendClient = SupabaseClient<Database>;
let client: BackendClient | undefined;

export function getBackendClient(): BackendClient | undefined {
  const config = getSupabaseConfig();
  if (!config) return undefined;
  client ??= createClient<Database>(config.url, config.publishableKey, {
    auth: {
      ...(Platform.OS !== 'web' && { storage: AsyncStorage }),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
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
