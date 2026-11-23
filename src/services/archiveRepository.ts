import { FunctionsHttpError } from '@supabase/supabase-js';

import {
  serializeArchiveMetadata,
  type ArchiveMetadata,
} from '@/features/archive/archiveMetadata';
import type { BackendClient } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type ArchiveItem = Tables<'archive_items'>;
export type ArchiveContextData = {
  people: { id: string; display_name: string }[];
  events: { id: string; title: string }[];
  canEdit: boolean;
  role: 'owner' | 'editor' | 'viewer';
};

async function paginate<T>(
  read: (
    start: number,
    end: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const output: T[] = [];
  for (let cursor = 0; ; cursor += 150) {
    const result = await read(cursor, cursor + 149);
    if (result.error) throw result.error;
    const rows = result.data ?? [];
    output.push(...rows);
    if (rows.length < 150) return output;
  }
}

export async function archiveError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const context = error.context as Response;
    try {
      const result = await context.json();
      if (typeof result.error === 'string' && result.error.length <= 250)
        return result.error;
    } catch {
      /* Fall back to a generic error. */
    }
  }
  if (
    error instanceof Error &&
    !(error instanceof FunctionsHttpError) &&
    error.message.startsWith('Choose')
  )
    return error.message;
  return 'Couldn’t complete the archive request. Check your access or connection and try again.';
}

export function createArchiveRepository(client: BackendClient, userId: string) {
  const storage = client.storage.from('family-archive');

  return {
    async trees() {
      const result = await client
        .from('family_trees')
        .select('id, name')
        .order('name');
      if (result.error) throw result.error;
      return result.data;
    },
    async context(treeId: string): Promise<ArchiveContextData> {
      const [membership, people, events] = await Promise.all([
        client
          .from('tree_memberships')
          .select('role')
          .eq('tree_id', treeId)
          .eq('user_id', userId)
          .single(),
        paginate((a, b) =>
          client
            .from('people')
            .select('id,display_name')
            .eq('tree_id', treeId)
            .order('display_name')
            .order('id')
            .range(a, b),
        ),
        paginate((a, b) =>
          client
            .from('life_events')
            .select('id,title')
            .eq('tree_id', treeId)
            .order('title')
            .order('id')
            .range(a, b),
        ),
      ]);
      if (membership.error) throw membership.error;
      return {
        people,
        events,
        canEdit: membership.data.role !== 'viewer',
        role: membership.data.role,
      };
    },
    async createEvent(treeId: string, title: string) {
      const { data, error } = await client
        .from('life_events')
        .insert({ tree_id: treeId, title: title.trim(), event_type: 'family' })
        .select('id,title')
        .single();
      if (error) throw error;
      return data;
    },
    async items(treeId: string) {
      return paginate((a, b) =>
        client
          .from('archive_items')
          .select(
            'id,title,description,collection,location,source_note,event_id,mime_type,thumbnail_path,file_name,recorded_on,date_precision,archive_item_people(person_id)',
          )
          .eq('tree_id', treeId)
          .order('created_at', { ascending: false })
          .order('id')
          .range(a, b),
      );
    },
    async item(id: string) {
      const result = await client
        .from('archive_items')
        .select('*,archive_item_people(person_id)')
        .eq('id', id)
        .single();
      if (result.error) throw result.error;
      return result.data;
    },
    async upload(treeId: string, body: ArrayBuffer) {
      const { data, error } = await client.functions.invoke<{
        id: string;
        duplicate: boolean;
      }>('archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-archive-tree': treeId,
        },
        body,
      });
      if (error) throw error;
      if (!data?.id) throw new Error('Archive response was incomplete.');
      return data;
    },
    async update(itemId: string, values: ArchiveMetadata) {
      const { meta, people } = serializeArchiveMetadata(values);
      const { error } = await client.rpc('update_archive_item', {
        p_id: itemId,
        p_meta: meta,
        p_people: people,
      });
      if (error) throw error;
    },
    async remove(itemId: string) {
      const { data, error } = await client.functions.invoke<{
        removed: boolean;
        cleanupPending: boolean;
      }>(`archive?id=${encodeURIComponent(itemId)}`, { method: 'DELETE' });
      if (error) throw error;
      if (!data?.removed) throw new Error('Archive response was incomplete.');
      return data;
    },
    async signed(path: string, download?: string) {
      const { data, error } = await storage.createSignedUrl(path, 60, {
        download,
      });
      if (error) throw error;
      return data.signedUrl;
    },
    async thumbnails(paths: string[]) {
      if (!paths.length) return new Map<string, string>();
      const { data, error } = await storage.createSignedUrls(paths, 60);
      if (error) throw error;
      return new Map(
        data.flatMap((item) =>
          item.path && item.signedUrl
            ? [[item.path, item.signedUrl] as const]
            : [],
        ),
      );
    },
  };
}

export type ArchiveRepository = ReturnType<typeof createArchiveRepository>;
