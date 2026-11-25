import { z } from 'zod';

import type { BackendClient } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export const languages = [
  { value: 'en', label: 'English' },
  { value: 'bg', label: 'Bulgarian' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
] as const;

export type Language = (typeof languages)[number]['value'];

export const userPreferencesSchema = z.object({
  user_id: z.string(),
  notify_email: z.boolean(),
  notify_push: z.boolean(),
  notify_invitations: z.boolean(),
  notify_corrections: z.boolean(),
  notify_collaboration: z.boolean(),
  notify_books: z.boolean(),
  notify_failures: z.boolean(),
  privacy_profile_visibility: z.enum(['private', 'members', 'public']),
  privacy_hide_living: z.boolean(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const defaultPreferences: Omit<UserPreferences, 'user_id'> = {
  notify_email: false,
  notify_push: false,
  notify_invitations: true,
  notify_corrections: true,
  notify_collaboration: true,
  notify_books: true,
  notify_failures: true,
  privacy_profile_visibility: 'private',
  privacy_hide_living: true,
};

export type Account = {
  profile: Tables<'profiles'>;
  treeId?: string;
  treeName?: string;
  preferences?: UserPreferences;
};

export function createAccountRepository(client: BackendClient) {
  return {
    async read(userId: string): Promise<Account> {
      const [profile, membership, prefs] = await Promise.all([
        client.from('profiles').select('*').eq('id', userId).single(),
        client
          .from('tree_memberships')
          .select('tree_id, family_trees(name)')
          .eq('user_id', userId)
          .order('created_at')
          .order('id')
          .limit(1)
          .maybeSingle(),
        client
          .from('user_preferences')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);
      if (profile.error) throw profile.error;
      if (membership.error) throw membership.error;

      let preferences: UserPreferences | undefined;
      if (prefs.data) {
        preferences = userPreferencesSchema.parse(prefs.data);
      }

      return {
        profile: profile.data,
        treeId: membership.data?.tree_id,
        treeName: membership.data?.family_trees?.name,
        preferences,
      };
    },

    async onboard(displayName: string, treeName: string) {
      const { error } = await client.rpc('complete_family_onboarding', {
        p_display_name: displayName,
        p_tree_name: treeName,
      });
      if (error) throw error;
    },

    async updateProfile(
      userId: string,
      displayName: string,
      language: Language,
    ) {
      const { error } = await client
        .from('profiles')
        .update({ display_name: displayName, preferred_language: language })
        .eq('id', userId)
        .select('id')
        .single();
      if (error) throw error;
    },

    async updatePreferences(
      userId: string,
      preferences: Partial<Omit<UserPreferences, 'user_id'>>,
    ) {
      const { error } = await client.from('user_preferences').upsert({
        user_id: userId,
        ...defaultPreferences,
        ...preferences,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },

    async exportData(): Promise<Record<string, unknown>> {
      const { data, error } = await client.rpc('export_personal_data');
      if (error) throw error;
      return (data as Record<string, unknown>) ?? {};
    },

    async deleteAccount(): Promise<void> {
      const { error } = await client.rpc('delete_user_account');
      if (error) throw error;
    },
  };
}
