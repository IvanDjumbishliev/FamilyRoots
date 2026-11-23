import { createPeopleRepository } from '@/services/peopleRepository';
import { createRelationshipRepository } from '@/services/relationshipRepository';
import {
  normalizeEventType,
  type TimelineEvent,
} from '@/features/timeline/timelineModel';
import type { BackendClient } from '@/lib/supabase';
import type { Json } from '@/types/database';

async function pages<T>(
  read: (
    start: number,
    end: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let start = 0; ; start += 150) {
    const result = await read(start, start + 149);
    if (result.error) throw result.error;
    const batch = result.data ?? [];
    rows.push(...batch);
    if (batch.length < 150) return rows;
  }
}

function mapEvent(row: {
  id: string;
  title: string;
  event_type: string;
  entry_kind: string;
  occurred_on: TimelineEvent['date'];
  date_precision: TimelineEvent['precision'];
  date_approximate: boolean;
  verification_status: TimelineEvent['verification'];
  place: string | null;
  notes: string | null;
  person_id: string | null;
  life_event_people: { person_id: string }[];
  life_event_archive_items: { item_id: string }[];
  source_citations: { source_id: string }[];
}): TimelineEvent {
  return {
    id: row.id,
    title: row.title,
    type: normalizeEventType(row.event_type),
    kind: row.entry_kind === 'context' ? 'context' : 'family',
    date: row.occurred_on,
    precision: row.date_precision,
    approximate: row.date_approximate,
    verification: row.verification_status,
    place: row.place,
    notes: row.notes,
    people: [
      ...new Set([
        ...row.life_event_people.map((link) => link.person_id),
        ...(row.person_id ? [row.person_id] : []),
      ]),
    ],
    items: row.life_event_archive_items.map((link) => link.item_id),
    sources: [
      ...new Set(row.source_citations.map((citation) => citation.source_id)),
    ],
  };
}

export function createTimelineRepository(
  client: BackendClient,
  userId: string,
) {
  const peopleService = createPeopleRepository(client, userId);
  const graph = createRelationshipRepository(client);
  const selection =
    '*,life_event_people(person_id),life_event_archive_items(item_id),source_citations(source_id,locator)';
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
    async read(tree: string) {
      const [access, relationshipData, rows, archiveLinks] = await Promise.all([
        peopleService.access(tree),
        graph.read(tree),
        pages((a, b) =>
          client
            .from('life_events')
            .select(selection)
            .eq('tree_id', tree)
            .order('id')
            .range(a, b),
        ),
        pages((a, b) =>
          client
            .from('archive_items')
            .select('id,event_id')
            .eq('tree_id', tree)
            .not('event_id', 'is', null)
            .order('id')
            .range(a, b),
        ),
      ]);
      return {
        ...access,
        people: relationshipData.people,
        connections: relationshipData.connections,
        events: rows.map((row) => {
          const event = mapEvent(row);
          return {
            ...event,
            items: [
              ...new Set([
                ...event.items,
                ...archiveLinks
                  .filter((link) => link.event_id === event.id)
                  .map((link) => link.id),
              ]),
            ],
          };
        }),
      };
    },
    async context(tree: string) {
      const [access, people, items, sources] = await Promise.all([
        peopleService.access(tree),
        pages((a, b) =>
          client
            .from('people')
            .select('id,display_name')
            .eq('tree_id', tree)
            .order('display_name')
            .order('id')
            .range(a, b),
        ),
        pages((a, b) =>
          client
            .from('archive_items')
            .select('id,title,mime_type,event_id')
            .eq('tree_id', tree)
            .order('title')
            .order('id')
            .range(a, b),
        ),
        pages((a, b) =>
          client
            .from('sources')
            .select('id,title,reference_url')
            .eq('tree_id', tree)
            .order('title')
            .order('id')
            .range(a, b),
        ),
      ]);
      return { ...access, people, items, sources };
    },
    async event(id: string) {
      const { data, error } = await client
        .from('life_events')
        .select(selection)
        .eq('id', id)
        .single();
      if (error) throw error;
      return {
        event: mapEvent(data),
        treeId: data.tree_id,
        version: data.updated_at,
        citations: data.source_citations,
      };
    },
    async save(tree: string, payload: Json) {
      const { data, error } = await client.rpc('save_timeline_event', {
        p_tree: tree,
        p_payload: payload,
      });
      if (error) throw error;
      return data;
    },
    async remove(tree: string, id: string, version: string) {
      const { error } = await client
        .from('life_events')
        .delete()
        .eq('tree_id', tree)
        .eq('id', id)
        .eq('updated_at', version)
        .select('id')
        .single();
      if (error) throw error;
    },
    async createSource(tree: string, title: string, url: string) {
      const { data, error } = await client
        .from('sources')
        .insert({ tree_id: tree, title, reference_url: url || null })
        .select('id,title,reference_url')
        .single();
      if (error) throw error;
      return data;
    },
  };
}

export type TimelineRepository = ReturnType<typeof createTimelineRepository>;
export type TimelineContextData = Awaited<
  ReturnType<TimelineRepository['context']>
>;
