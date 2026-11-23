import { randomUUID } from 'expo-crypto';

import type { PersonChanges } from '@/features/people/personForm';
import type { BackendClient } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type ConnectedPerson = Tables<'people'>;
export type DirectoryPerson = Pick<
  ConnectedPerson,
  | 'id'
  | 'display_name'
  | 'birth_name'
  | 'alternative_names'
  | 'living_status'
  | 'is_draft'
  | 'archived_at'
  | 'verification_status'
>;

export const isRecordId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

export function createPeopleRepository(client: BackendClient, userId: string) {
  async function access(treeId: string) {
    const result = await client
      .from('tree_memberships')
      .select('role, family_trees(name)')
      .eq('tree_id', treeId)
      .eq('user_id', userId)
      .single();
    if (result.error) throw result.error;
    return {
      canEdit: result.data.role !== 'viewer',
      name: result.data.family_trees?.name ?? 'Family tree',
    };
  }

  const storage = client.storage.from('family-media');
  return {
    access,
    async trees() {
      const { data, error } = await client
        .from('family_trees')
        .select('id, name')
        .order('name')
        .order('id');
      if (error) throw error;
      return data;
    },
    async directory(treeId: string) {
      const [permissions, first] = await Promise.all([
        access(treeId),
        client
          .from('people')
          .select(
            'id, display_name, birth_name, alternative_names, living_status, is_draft, archived_at, verification_status',
            { count: 'exact' },
          )
          .eq('tree_id', treeId)
          .order('display_name')
          .order('id')
          .range(0, 199),
      ]);
      if (first.error) throw first.error;
      const people: DirectoryPerson[] = first.data;
      for (let start = people.length; start < (first.count ?? 0); ) {
        const { data, error } = await client
          .from('people')
          .select(
            'id, display_name, birth_name, alternative_names, living_status, is_draft, archived_at, verification_status',
          )
          .eq('tree_id', treeId)
          .order('display_name')
          .order('id')
          .range(start, start + 199);
        if (error) throw error;
        if (!data.length) break;
        people.push(...data);
        start += data.length;
      }
      return { ...permissions, people };
    },
    async person(id: string) {
      const { data: person, error } = await client
        .from('people')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return { person, ...(await access(person.tree_id)) };
    },
    async details(person: ConnectedPerson) {
      const [sources, activity, photo] = await Promise.all([
        client
          .from('source_citations')
          .select('id, locator, sources(title, reference_url)')
          .eq('tree_id', person.tree_id)
          .eq('person_id', person.id),
        client
          .from('activity_logs')
          .select('id, operation, changed_fields, created_at')
          .eq('tree_id', person.tree_id)
          .eq('entity_type', 'people')
          .eq('entity_id', person.id)
          .order('created_at', { ascending: false })
          .limit(20),
        person.profile_photo_id
          ? client
              .from('media_assets')
              .select('storage_path')
              .eq('tree_id', person.tree_id)
              .eq('id', person.profile_photo_id)
              .maybeSingle()
          : Promise.resolve(null),
      ]);
      if (sources.error) throw sources.error;
      if (activity.error) throw activity.error;
      const signed = photo?.data
        ? await storage.createSignedUrl(photo.data.storage_path, 60)
        : undefined;
      return {
        sources: sources.data,
        activity: activity.data,
        photoUri: signed?.data?.signedUrl,
        photoUnavailable: Boolean(person.profile_photo_id && !signed?.data),
      };
    },
    async create(treeId: string, values: PersonChanges) {
      const { data, error } = await client
        .from('people')
        .insert({ ...values, tree_id: treeId })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    async update(person: ConnectedPerson, values: PersonChanges) {
      const { error } = await client
        .from('people')
        .update(values)
        .eq('id', person.id)
        .eq('tree_id', person.tree_id)
        .eq('updated_at', person.updated_at)
        .is('archived_at', null)
        .select('id')
        .single();
      if (error) throw error;
    },
    async setArchived(person: ConnectedPerson, archived: boolean) {
      const { error } = await client
        .from('people')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', person.id)
        .eq('tree_id', person.tree_id)
        .eq('updated_at', person.updated_at)
        .select('id')
        .single();
      if (error) throw error;
    },
    async addSource(
      person: ConnectedPerson,
      source: { title: string; url: string; locator: string },
    ) {
      const { error } = await client.rpc('add_person_source', {
        p_tree_id: person.tree_id,
        p_person_id: person.id,
        p_title: source.title,
        p_url: source.url,
        p_locator: source.locator,
      });
      if (error) throw error;
    },
    async attachPhoto(
      person: ConnectedPerson,
      photo: { name: string; mimeType: string; bytes: ArrayBuffer },
    ) {
      if (
        !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
          photo.mimeType,
        ) ||
        photo.bytes.byteLength < 1 ||
        photo.bytes.byteLength > 10 * 1024 * 1024
      ) {
        throw new Error('Choose a supported photograph no larger than 10 MB.');
      }
      const path = `${person.tree_id}/${randomUUID()}`;
      const uploaded = await storage.upload(path, photo.bytes, {
        contentType: photo.mimeType,
        cacheControl: '0',
        upsert: false,
      });
      if (uploaded.error) throw uploaded.error;
      const result = await client.rpc('attach_person_photo', {
        p_tree_id: person.tree_id,
        p_person_id: person.id,
        p_path: path,
        p_name: photo.name.slice(0, 255),
        p_content_type: photo.mimeType,
        p_size: photo.bytes.byteLength,
      });
      if (result.error) {
        // A transport failure can occur after commit. Confirm that the record
        // does not reference this object before removing it.
        const saved = await client
          .from('media_assets')
          .select('id')
          .eq('storage_path', path)
          .maybeSingle();
        if (saved.data) return;
        if (!saved.error) await storage.remove([path]);
        throw result.error;
      }
    },
  };
}

export type PeopleRepository = ReturnType<typeof createPeopleRepository>;
