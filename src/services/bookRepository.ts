import { z } from 'zod';

import type { BackendClient } from '@/lib/supabase';
import {
  sectionKeys,
  type BookSettings,
  type Section,
} from '../../supabase/functions/family-book-worker/book';

const photoSchema = z.object({
  id: z.string(),
  caption: z.string().optional(),
});

const sectionSchema = z.object({
  key: z.enum(sectionKeys),
  title: z.string(),
  paragraphs: z.array(z.string()),
  edit: z.string().optional(),
  mediaIds: z.array(z.string()).optional(),
  photos: z.array(photoSchema).optional(),
});

const revisionSchema = z.object({
  id: z.string(),
  book_id: z.string(),
  revision: z.number(),
  title: z.string(),
  settings: z.unknown(),
  sections: z.array(sectionSchema),
  created_at: z.string(),
});

export type BookRevision = z.infer<typeof revisionSchema>;

export function createBookRepository(client: BackendClient) {
  return {
    async list() {
      const { data, error } = await client
        .from('family_books')
        .select('id,settings,status,operation,updated_at,revision')
        .order('updated_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data.map(({ settings, ...book }) => ({
        ...book,
        title: z.object({ title: z.string() }).parse(settings).title,
      }));
    },
    async read(id: string) {
      const { data, error } = await client
        .from('family_books')
        .select(
          'id,tree_id,status,operation,revision,error,pdf_path,pdf_revision,settings,sections',
        )
        .eq('id', id)
        .single();
      if (error) throw error;
      const parsedSections = z.array(sectionSchema).parse(data.sections);
      return {
        ...data,
        settings: data.settings as BookSettings,
        sections: parsedSections,
        title: z.object({ title: z.string() }).parse(data.settings).title,
      };
    },
    async create(tree: string, settings: BookSettings) {
      const { data, error } = await client.rpc('create_family_book', {
        p_tree: tree,
        p_settings: settings,
      });
      if (error) throw error;
      return data;
    },
    async saveDraft(
      id: string,
      revision: number,
      settings: BookSettings,
      sections: Section[],
    ): Promise<number> {
      const { data, error } = await client.rpc('save_family_book_draft', {
        p_id: id,
        p_revision: revision,
        p_settings: settings,
        p_sections: sections,
      });
      if (error) throw error;
      return (data as number) ?? revision + 1;
    },
    async revisions(id: string): Promise<BookRevision[]> {
      const { data, error } = await client
        .from('family_book_revisions')
        .select('id,book_id,revision,title,settings,sections,created_at')
        .eq('book_id', id)
        .order('revision', { ascending: false })
        .limit(30);
      if (error) {
        // If revisions table is not accessible, return empty list gracefully
        return [];
      }
      return z.array(revisionSchema).catch([]).parse(data);
    },
    async edit(id: string, revision: number, key: string, body: string) {
      const { error } = await client.rpc('edit_family_book_section', {
        p_id: id,
        p_revision: revision,
        p_key: key,
        p_body: body,
      });
      if (error) throw error;
    },
    async queue(
      id: string,
      revision: number,
      action: 'pdf' | 'retry' | 'section',
      key?: string,
    ) {
      const { error } = await client.rpc('queue_family_book', {
        p_id: id,
        p_revision: revision,
        p_action: action,
        p_section: key,
        p_reviewed: action === 'pdf',
      });
      if (error) throw error;
    },
    async wake(bookId: string) {
      const { error } = await client.functions.invoke('family-book-worker', {
        body: { bookId },
      });
      if (error) throw error;
    },
    async download(path: string) {
      const { data, error } = await client.storage
        .from('family-books')
        .createSignedUrl(path, 60, { download: 'family-history.pdf' });
      if (error) throw error;
      return data.signedUrl;
    },
  };
}
export type BookRepository = ReturnType<typeof createBookRepository>;
export function bookError(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === '42501')
      return 'You don’t have permission to change this book.';
    if (error.code === 'P0002')
      return 'The book changed. Refresh and try again.';
    if (error.code === 'P0001') return 'You reached the daily book limit.';
  }
  return 'Couldn’t complete the book request. Try again.';
}
