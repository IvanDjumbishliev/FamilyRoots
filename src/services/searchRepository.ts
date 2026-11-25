import { z } from 'zod';

import type { BackendClient } from '@/lib/supabase';

export const searchItemSchema = z.object({
  id: z.string(),
  category: z.enum(['person', 'event', 'archive', 'book']),
  tree_id: z.string(),
  tree_name: z.string().nullable(),
  title: z.string(),
  subtitle: z.string().nullable(),
  detail: z.string().nullable(),
  link: z.string(),
  created_at: z.string(),
});

export type SearchItem = z.infer<typeof searchItemSchema>;

export type SearchFilters = {
  query: string;
  treeId?: string;
  category?: 'all' | 'people' | 'events' | 'archive' | 'books';
  limit?: number;
  offset?: number;
};

export function createSearchRepository(client: BackendClient) {
  return {
    async search({
      query,
      treeId,
      category = 'all',
      limit = 20,
      offset = 0,
    }: SearchFilters): Promise<SearchItem[]> {
      if (!query.trim()) return [];

      const { data, error } = await client.rpc('global_search', {
        p_query: query.trim(),
        p_tree_id: treeId || null,
        p_category: category,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) throw error;
      return z.array(searchItemSchema).parse(data ?? []);
    },
  };
}

export type SearchRepository = ReturnType<typeof createSearchRepository>;
