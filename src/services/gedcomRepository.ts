import { z } from 'zod';

import type { Transfer } from '@/features/gedcom/model';
import type { BackendClient } from '@/lib/supabase';

const dates = z.object({
  date: z.string().nullable(),
  precision: z.enum(['unknown', 'year', 'month', 'day']),
  approximate: z.boolean(),
});
const citations = z.array(
  z.object({ source: z.string(), page: z.string(), notes: z.string() }),
);
const transfer: z.ZodType<Transfer> = z.object({
  people: z.array(
    z.object({
      ref: z.string(),
      name: z.string(),
      given: z.string(),
      surname: z.string(),
      aliases: z.array(z.string()),
      status: z.enum(['living', 'deceased', 'unknown']),
      birth: dates,
      death: dates,
      birthPlace: z.string(),
      deathPlace: z.string(),
      notes: z.string(),
      biography: z.string().optional(),
      citations,
    }),
  ),
  parents: z.array(
    z.object({
      parent: z.string(),
      child: z.string(),
      kind: z.string(),
      notes: z.string(),
      citations,
    }),
  ),
  partners: z.array(
    z.object({
      a: z.string(),
      b: z.string(),
      kind: z.string(),
      status: z.string(),
      start: dates,
      end: dates,
      notes: z.string(),
      citations,
    }),
  ),
  events: z.array(
    z.object({
      people: z.array(z.string()),
      title: z.string(),
      type: z.string(),
      when: dates,
      place: z.string(),
      notes: z.string(),
      citations,
    }),
  ),
  sources: z.array(
    z.object({
      ref: z.string(),
      title: z.string(),
      url: z.string(),
      notes: z.string(),
    }),
  ),
});
const summary = z.object({
  created: z.number(),
  merged: z.number(),
  relationships: z.number(),
  events: z.number(),
  sources: z.number(),
  skipped: z.number(),
  kept: z.number(),
  failed: z.number(),
  error: z.string().optional(),
});
export type ImportSummary = z.infer<typeof summary>;
export type Candidate = {
  id: string;
  display_name: string;
  birth_date: string | null;
  birth_name: string | null;
  alternative_names: string[];
};

export function createGedcomRepository(client: BackendClient) {
  return {
    async candidates(tree: string) {
      const list: Candidate[] = [];
      const size = 300;
      for (let start = 0; ; start += size) {
        const { data, error } = await client
          .from('people')
          .select('id,display_name,birth_date,birth_name,alternative_names')
          .eq('tree_id', tree)
          .is('archived_at', null)
          .eq('is_draft', false)
          .order('id')
          .range(start, start + size - 1);
        if (error) throw error;
        list.push(...data);
        if (data.length < size) return list;
      }
    },
    async commit(
      tree: string,
      data: Transfer,
      choices: Record<string, string>,
      request: string,
    ) {
      const { data: result, error } = await client.rpc('import_gedcom', {
        p_tree: tree,
        p_data: data,
        p_choices: choices,
        p_request: request,
      });
      if (error) throw error;
      return summary.parse(result);
    },
    async export(tree: string, excludeLiving: boolean) {
      const { data, error } = await client.rpc('export_gedcom', {
        p_tree: tree,
        p_exclude_living: excludeLiving,
      });
      if (error) throw error;
      return transfer.parse(data);
    },
  };
}
export type GedcomRepository = ReturnType<typeof createGedcomRepository>;

export function transferError(error: unknown) {
  if (error instanceof Error && !(error instanceof z.ZodError))
    return error.message;
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === '42501')
      return 'Your current tree role does not allow this action.';
    if (
      error.code === '22023' &&
      'message' in error &&
      typeof error.message === 'string'
    )
      return error.message;
  }
  return 'Couldn’t complete the transfer. Check your connection and tree access.';
}
