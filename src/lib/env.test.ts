import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSupabaseConfig } from './env';

test('allows the app to run without Supabase', () => {
  assert.equal(readSupabaseConfig('', ' '), undefined);
});

test('accepts a Supabase URL and publishable key', () => {
  const url = 'https://example.supabase.co';
  const publishableKey = 'sb_publishable_example';
  assert.deepEqual(readSupabaseConfig(url, publishableKey), {
    url,
    publishableKey,
  });
});

test('rejects incomplete configuration, malformed URLs, and secret keys', () => {
  assert.throws(() => readSupabaseConfig('https://example.supabase.co'));
  assert.throws(() => readSupabaseConfig('invalid', 'sb_publishable_example'));
  assert.throws(() =>
    readSupabaseConfig('https://example.supabase.co', 'sb_secret_example'),
  );
});
