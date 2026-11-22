import { z } from 'zod';

const supabaseConfig = z.object({
  url: z.url({ protocol: /^https?$/ }),
  publishableKey: z.string().startsWith('sb_publishable_').min(16),
});

export function readSupabaseConfig(url?: string, publishableKey?: string) {
  if (!url?.trim() && !publishableKey?.trim()) return undefined;

  const result = supabaseConfig.safeParse({
    url: url?.trim(),
    publishableKey: publishableKey?.trim(),
  });
  if (!result.success) {
    throw new Error('Set a valid Supabase URL and publishable key together.');
  }
  return result.data;
}

export function getSupabaseConfig() {
  return readSupabaseConfig(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
