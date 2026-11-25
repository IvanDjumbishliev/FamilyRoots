import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createAccountRepository,
  defaultPreferences,
  userPreferencesSchema,
  type UserPreferences,
} from './accountRepository';

test('validates user preferences schema and defaults', () => {
  const prefs: UserPreferences = {
    user_id: 'user-xyz',
    notify_email: true,
    notify_push: false,
    notify_invitations: true,
    notify_corrections: true,
    notify_collaboration: true,
    notify_books: true,
    notify_failures: true,
    privacy_profile_visibility: 'members',
    privacy_hide_living: true,
  };

  const parsed = userPreferencesSchema.parse(prefs);
  assert.equal(parsed.notify_email, true);
  assert.equal(parsed.privacy_profile_visibility, 'members');
  assert.equal(defaultPreferences.privacy_profile_visibility, 'private');
});

test('account repository supports updatePreferences, exportData, and deleteAccount', async () => {
  let upsertedData: any = null;
  let rpcCalled = '';

  const mockClient: any = {
    from: (table: string) => ({
      upsert: async (data: any) => {
        upsertedData = data;
        return { error: null };
      },
    }),
    rpc: async (name: string) => {
      rpcCalled = name;
      if (name === 'export_personal_data') {
        return {
          data: {
            profile: { id: 'u-1', display_name: 'Tester' },
            trees: [],
          },
          error: null,
        };
      }
      if (name === 'delete_user_account') {
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
  };

  const repo = createAccountRepository(mockClient);

  // Update preferences
  await repo.updatePreferences('u-1', { notify_push: true });
  assert.equal(upsertedData.user_id, 'u-1');
  assert.equal(upsertedData.notify_push, true);

  // Export personal data
  const exported = await repo.exportData();
  assert.equal(rpcCalled, 'export_personal_data');
  assert.deepEqual(exported.profile, { id: 'u-1', display_name: 'Tester' });

  // Delete user account
  await repo.deleteAccount();
  assert.equal(rpcCalled, 'delete_user_account');
});
