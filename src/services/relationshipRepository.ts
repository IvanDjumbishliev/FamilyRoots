import type { BackendClient } from '@/lib/supabase';
import type { Json } from '@/types/database';
import type { Connection } from '@/features/relationships/relationshipGraph';

async function allRows<T>(
  getPage: (
    start: number,
    end: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  const size = 200;
  for (let start = 0; ; start += size) {
    const result = await getPage(start, start + size - 1);
    if (result.error) throw result.error;
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < size) return rows;
  }
}

export function createRelationshipRepository(client: BackendClient) {
  return {
    async read(treeId: string) {
      const [people, parents, partners, other] = await Promise.all([
        allRows((start, end) =>
          client
            .from('people')
            .select(
              'id, display_name, alternative_names, birth_name, archived_at, is_draft',
            )
            .eq('tree_id', treeId)
            .order('id')
            .range(start, end),
        ),
        allRows((start, end) =>
          client
            .from('parent_child_relationships')
            .select('*')
            .eq('tree_id', treeId)
            .order('id')
            .range(start, end),
        ),
        allRows((start, end) =>
          client
            .from('partnerships')
            .select('*')
            .eq('tree_id', treeId)
            .order('id')
            .range(start, end),
        ),
        allRows((start, end) =>
          client
            .from('other_family_relationships')
            .select('*')
            .eq('tree_id', treeId)
            .order('id')
            .range(start, end),
        ),
      ]);
      const connections: Connection[] = [
        ...parents.map((row) => ({
          category: 'parent' as const,
          id: row.id,
          parent: row.parent_id,
          child: row.child_id,
          kind: row.kind,
          notes: row.notes,
          provenance: row.provenance,
          verification: row.verification_status,
        })),
        ...partners.map((row) => ({
          category: 'partnership' as const,
          id: row.id,
          a: row.person_a_id,
          b: row.person_b_id,
          kind: row.kind,
          status: row.status,
          notes: row.notes,
          provenance: row.provenance,
          verification: row.verification_status,
          startedOn: row.started_on,
          startPrecision: row.start_date_precision,
          startApproximate: row.start_date_approximate,
          endedOn: row.ended_on,
          endPrecision: row.end_date_precision,
          endApproximate: row.end_date_approximate,
        })),
        ...other.map((row) => ({
          category: 'other' as const,
          id: row.id,
          a: row.person_a_id,
          b: row.person_b_id,
          label: row.label,
          notes: row.notes,
          provenance: row.provenance,
          verification: row.verification_status,
        })),
      ];
      return { people, connections };
    },
    async save(treeId: string, personId: string, values: Json) {
      const { error } = await client.rpc('save_family_connection', {
        p_tree_id: treeId,
        p_person_id: personId,
        p_connection: values,
      });
      if (error) throw error;
    },
    async remove(treeId: string, connection: Connection) {
      const table =
        connection.category === 'parent'
          ? 'parent_child_relationships'
          : connection.category === 'partnership'
            ? 'partnerships'
            : 'other_family_relationships';
      const { error } = await client
        .from(table)
        .delete()
        .eq('tree_id', treeId)
        .eq('id', connection.id)
        .select('id')
        .single();
      if (error) throw error;
    },
  };
}

export function connectionError(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    if (
      error.code === '23514' &&
      'message' in error &&
      error.message === 'Ancestry cycle'
    ) {
      return 'This would make a person their own ancestor. Check the parent and child direction.';
    }
    if (error.code === '23505') return 'This connection already exists.';
    if (error.code === '42501')
      return 'You don’t have permission to change this connection.';
  }
  return 'Couldn’t save the connection. Check the details and try again.';
}

export type RelationshipRepository = ReturnType<
  typeof createRelationshipRepository
>;
export type RelationshipData = Awaited<
  ReturnType<RelationshipRepository['read']>
>;
