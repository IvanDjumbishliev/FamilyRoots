import type { BackendClient } from '@/lib/supabase';
import type { Database, Tables } from '@/types/database';

export type ConnectedTree = Pick<Tables<'family_trees'>, 'id' | 'name'>;
type ConnectedPerson = Pick<
  Tables<'people'>,
  'id' | 'display_name' | 'living_status'
>;

export interface ConnectedFamilyRepository {
  listTrees(): Promise<ConnectedTree[]>;
  createTree(name: string): Promise<ConnectedTree>;
  readTree(
    treeId: string,
    userId: string,
  ): Promise<{
    people: ConnectedPerson[];
    role: Database['public']['Enums']['tree_role'];
  }>;
}

export function describeBackendError(error: unknown) {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? error.code
      : undefined;
  switch (code) {
    case 'invalid_credentials':
      return 'Check your email and password and try again.';
    case 'email_not_confirmed':
      return 'Confirm your email before signing in.';
    case '42501':
    case 'PGRST116':
      return 'You don’t have access to perform this action.';
    case '23505':
      return 'This record already exists.';
    default:
      return 'Couldn’t complete the request. Check your connection and try again.';
  }
}

export function createSupabaseFamilyRepository(
  client: BackendClient,
): ConnectedFamilyRepository {
  return {
    async listTrees() {
      const { data, error } = await client
        .from('family_trees')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
    async createTree(name) {
      const { data, error } = await client
        .from('family_trees')
        .insert({ name })
        .select('id, name')
        .single();
      if (error) throw error;
      return data;
    },
    async readTree(treeId, userId) {
      const [membership, people] = await Promise.all([
        client
          .from('tree_memberships')
          .select('role')
          .eq('tree_id', treeId)
          .eq('user_id', userId)
          .single(),
        client
          .from('people')
          .select('id, display_name, living_status')
          .eq('tree_id', treeId)
          .is('archived_at', null)
          .eq('is_draft', false)
          .order('display_name'),
      ]);
      if (membership.error) throw membership.error;
      if (people.error) throw people.error;
      return { role: membership.data.role, people: people.data };
    },
  };
}
