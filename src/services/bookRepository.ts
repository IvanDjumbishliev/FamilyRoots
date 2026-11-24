import { z } from 'zod';

import type { BackendClient } from '@/lib/supabase';
import {
  sectionKeys,
  type BookSettings,
} from '../../supabase/functions/family-book-worker/book';

const sectionSchema = z.object({
  key: z.enum(sectionKeys),
  title: z.string(),
  paragraphs: z.array(z.string()),
  edit: z.string().optional(),
  mediaIds: z.array(z.string()).optional(),
});
export function createBookRepository(client: BackendClient) {
  return {
    async list() {
      const { data, error } = await client
        .from('family_books')
        .select('id,settings,status,operation,updated_at')
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
          'id,status,operation,revision,error,pdf_path,pdf_revision,settings,sections',
        )
        .eq('id', id)
        .single();
      if (error) throw error;
      return {
        ...data,
        sections: z.array(sectionSchema).parse(data.sections),
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
