import { FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';

import type { BackendClient } from '@/lib/supabase';

export const assistantTasks = [
  { value: 'summary', label: 'Verified summary' },
  { value: 'questions', label: 'Research questions' },
  { value: 'gaps', label: 'Missing profile information' },
  { value: 'document', label: 'Explain document text' },
  { value: 'matches', label: 'Possible record matches' },
  { value: 'interview', label: 'Plan a family interview' },
  { value: 'biography', label: 'Draft a biography' },
  { value: 'relationship', label: 'Explain a relationship' },
  { value: 'plan', label: 'Plan research for an unknown ancestor' },
] as const;
export type AssistantTask = (typeof assistantTasks)[number]['value'];

const response = z.strictObject({
  mode: z.enum(['mock', 'live', 'fallback']),
  statements: z
    .array(
      z.strictObject({
        id: z.number().int().positive(),
        status: z.enum(['verified', 'reported', 'unknown', 'suggestion']),
        category: z.string().max(48),
        text: z.string().min(1).max(1400),
        citations: z
          .array(
            z.strictObject({
              kind: z.enum([
                'profile',
                'event',
                'record',
                'relationship',
                'document',
                'discovery',
              ]),
              label: z.string().min(1).max(600),
              id: z.uuid().optional(),
            }),
          )
          .max(10),
      }),
    )
    .min(1)
    .max(24),
});
export type AssistantResult = z.infer<typeof response>;

export function createAssistantRepository(client: BackendClient) {
  return {
    async request(
      tree: string,
      task: AssistantTask,
      people: string[],
      document?: string,
    ) {
      const { data, error } = await client.functions.invoke(
        'genealogy-assistant',
        { body: { tree, task, people, document } },
      );
      if (error instanceof FunctionsHttpError) {
        const body: unknown = await error.context.json().catch(() => undefined);
        if (
          body &&
          typeof body === 'object' &&
          'error' in body &&
          typeof body.error === 'string'
        )
          throw new Error(body.error);
      }
      if (error) throw new Error('Couldn’t contact the assistant. Try again.');
      const parsed = response.safeParse(data);
      if (!parsed.success)
        throw new Error(
          'The assistant returned an unsupported response. Try again.',
        );
      return parsed.data;
    },
  };
}
export type AssistantRepository = ReturnType<typeof createAssistantRepository>;
