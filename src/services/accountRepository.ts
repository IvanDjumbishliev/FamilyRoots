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
export type Account = {
  profile: Tables<'profiles'>;
  treeId?: string;
  treeName?: string;
};

export function createAccountRepository(client: BackendClient) {
  return {
    async read(userId: string): Promise<Account> {
      const [profile, membership] = await Promise.all([
        client.from('profiles').select('*').eq('id', userId).single(),
        client
          .from('tree_memberships')
          .select('tree_id, family_trees(name)')
          .eq('user_id', userId)
          .order('created_at')
          .order('id')
          .limit(1)
          .maybeSingle(),
      ]);
      if (profile.error) throw profile.error;
      if (membership.error) throw membership.error;
      return {
        profile: profile.data,
        treeId: membership.data?.tree_id,
        treeName: membership.data?.family_trees?.name,
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
  };
}
