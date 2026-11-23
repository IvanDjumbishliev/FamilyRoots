import { FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';

import type { BackendClient } from '@/lib/supabase';
import type { Database, Tables } from '@/types/database';

export type CollaborationRole = Database['public']['Enums']['tree_role'];
export type ReviewTarget =
  | 'people'
  | 'life_events'
  | 'parent_child_relationships'
  | 'partnerships'
  | 'other_family_relationships';
export type CommentColumn = 'person_id' | 'archive_item_id' | 'source_id';
export type Review = Tables<'tree_reviews'>;
const role = z.enum(['owner', 'editor', 'viewer']);
const summarySchema = z.object({
  role,
  members: z.array(
    z.object({ id: z.string(), name: z.string().nullable(), role }),
  ),
  invitations: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      role,
      status: z.string(),
      expiresAt: z.string(),
      sentAt: z.string().nullable(),
    }),
  ),
  changes: z.array(
    z.object({
      id: z.string(),
      actorId: z.string().nullable(),
      entity: z.string(),
      operation: z.string(),
      at: z.string(),
      fields: z.array(z.string()),
      unread: z.boolean(),
    }),
  ),
});
const reviewValue = z.object({
  value: z.string().nullable(),
  version: z.string().nullable(),
  label: z.string(),
  available: z.boolean(),
  aiSuggested: z.boolean(),
});

export async function collaborationError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const response = await (error.context as Response).json();
      if (typeof response.error === 'string' && response.error.length < 250)
        return response.error;
    } catch {
      /* Use the generic request error. */
    }
  }
  if (typeof error === 'object' && error && 'code' in error) {
    if (error.code === 'P0002')
      return 'The record has changed. Reload it and compare the latest value before applying.';
    if (error.code === '23505')
      return 'A review for this relationship is already pending.';
    if (error.code === '42501')
      return 'Your account does not have access to complete this action.';
  }
  return 'Couldn’t complete the collaboration request. Try again.';
}

export function createCollaborationRepository(client: BackendClient) {
  return {
    async trees() {
      const { data, error } = await client
        .from('family_trees')
        .select('id,name')
        .order('name')
        .order('id');
      if (error) throw error;
      return data;
    },
    async summary(tree: string) {
      const { data, error } = await client.rpc('get_tree_collaboration', {
        p_tree: tree,
      });
      if (error) throw error;
      return summarySchema.parse(data);
    },
    async invite(
      tree: string,
      email: string,
      role: Exclude<CollaborationRole, 'owner'>,
      consent: boolean,
    ) {
      const { data, error } = await client.functions.invoke<{
        id: string;
        delivered: boolean;
      }>('collaboration', { body: { tree, email, role, consent } });
      if (error) throw error;
      if (!data?.id) throw new Error('Invitation was not recorded.');
      return data;
    },
    async inbox() {
      const { data, error } = await client.rpc('list_my_tree_invitations');
      if (error) throw error;
      return data;
    },
    async respond(id: string, accept: boolean) {
      const { data, error } = await client.rpc('respond_to_tree_invitation', {
        p_id: id,
        p_accept: accept,
      });
      if (error) throw error;
      return data;
    },
    async cancel(tree: string, id: string) {
      const { error } = await client.rpc('cancel_tree_invitation', {
        p_tree: tree,
        p_id: id,
      });
      if (error) throw error;
    },
    async changeMember(
      tree: string,
      member: string,
      role: Exclude<CollaborationRole, 'owner'> | null,
    ) {
      const { error } = await client.rpc('manage_tree_member', {
        p_tree: tree,
        p_member: member,
        p_role: role ?? 'viewer',
        p_remove: role === null,
      });
      if (error) throw error;
    },
    async markRead(tree: string, through: string) {
      const { error } = await client.rpc('mark_tree_updates_read', {
        p_tree: tree,
        p_through: through,
      });
      if (error) throw error;
    },
    async comments(tree: string, column: CommentColumn, id: string) {
      const { data, error } = await client
        .from('collaboration_comments')
        .select('id,body,author_id,created_at')
        .eq('tree_id', tree)
        .eq(column, id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    async comment(
      tree: string,
      column: CommentColumn,
      id: string,
      body: string,
    ) {
      const target =
        column === 'person_id'
          ? { person_id: id }
          : column === 'archive_item_id'
            ? { archive_item_id: id }
            : { source_id: id };
      const { error } = await client
        .from('collaboration_comments')
        .insert({ tree_id: tree, ...target, body });
      if (error) throw error;
    },
    async reviews(tree: string) {
      const { data, error } = await client
        .from('tree_reviews')
        .select('*')
        .eq('tree_id', tree)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    async propose(
      tree: string,
      targetType: ReviewTarget,
      target: string,
      field: string,
      proposed: string,
      reason: string,
    ) {
      const { error } = await client.rpc('propose_tree_review', {
        p_tree: tree,
        p_target_type: targetType,
        p_target: target,
        p_field: field,
        p_proposed: proposed,
        p_reason: reason,
      });
      if (error) throw error;
    },
    async inspect(id: string) {
      const { data, error } = await client.rpc('inspect_tree_review', {
        p_id: id,
      });
      if (error) throw error;
      return reviewValue.parse(data);
    },
    async resolve(
      id: string,
      decision: string,
      version: string | null,
      note: string,
    ) {
      const { error } = await client.rpc('resolve_tree_review', {
        p_id: id,
        p_decision: decision,
        p_version: version ?? undefined,
        p_note: note,
      });
      if (error) throw error;
    },
  };
}

export type CollaborationRepository = ReturnType<
  typeof createCollaborationRepository
>;
