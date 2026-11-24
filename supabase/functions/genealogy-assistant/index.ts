import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { z } from 'npm:zod@4.3.6';

import {
  applyOutline,
  createStatements,
  publicOutline,
  tasks,
  type Context,
  type Statement,
  type Task,
} from './core.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const input = z
  .strictObject({
    tree: z.uuid(),
    task: z.enum(tasks),
    people: z.array(z.uuid()).max(2),
    document: z.string().trim().max(6000).optional(),
  })
  .superRefine(({ task, people, document }, ctx) => {
    const correctProfiles =
      task === 'relationship'
        ? people.length === 2 && people[0] !== people[1]
        : ['gaps', 'matches', 'biography'].includes(task)
          ? people.length === 1
          : task === 'summary'
            ? people.length <= 1
            : people.length === 0;
    if (
      !correctProfiles ||
      (task === 'document' ? !document : Boolean(document))
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Choose the required profiles or supply a document excerpt.',
      });
    }
  });

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const precision = z.enum(['unknown', 'year', 'month', 'day']);
const context: z.ZodType<Context> = z.object({
  people: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string().max(160),
        status: z.enum(['verified', 'unverified', 'disputed']),
        birth: date,
        death: date,
        birthPrecision: precision,
        deathPrecision: precision,
        birthApproximate: z.boolean(),
        deathApproximate: z.boolean(),
        birthPlace: z.string().max(240).nullable(),
        deathPlace: z.string().max(240).nullable(),
        occupation: z.string().max(160).nullable(),
      }),
    )
    .max(5),
  events: z
    .array(
      z.object({
        id: z.uuid(),
        title: z.string().max(160),
        day: date,
        precision,
        approximate: z.boolean(),
      }),
    )
    .max(10),
  sources: z
    .array(
      z.object({
        id: z.uuid(),
        title: z.string().max(255),
        locator: z.string().max(300).nullable(),
        personId: z.uuid().nullable(),
        eventId: z.uuid().nullable(),
      }),
    )
    .max(25),
  edges: z
    .array(
      z.object({
        id: z.uuid(),
        a: z.uuid(),
        b: z.uuid(),
        kind: z.string().max(80),
        verified: z.boolean(),
        relation: z.enum(['parent', 'partner']),
      }),
    )
    .max(601),
  edgeNames: z.record(z.uuid(), z.string().max(160)),
  matches: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().max(220),
        year: z.number().int(),
        place: z.string().max(120),
        collection: z.string().max(200),
        locator: z.string().max(180),
      }),
    )
    .max(5),
});
const providerEnvelope = z.object({
  status: z.literal('completed'),
  output: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(
          z.object({ type: z.string(), text: z.string().max(2048).optional() }),
        )
        .optional(),
    }),
  ),
});

function reply(status: number, body: object) {
  return new Response(JSON.stringify(body), { status, headers });
}

async function readBody(request: Pick<Request, 'body'>, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '',
    size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      return undefined;
    }
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode()) as unknown;
}

async function organize(
  task: Task,
  statements: Statement[],
  key: string,
  model: string,
) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 256,
      instructions:
        'Organize the supplied numbered genealogy response items. Use every id exactly once. Preserve birth before death, place unknown details after supported statements, and place practical next steps last. Return only the order.',
      input: JSON.stringify(publicOutline(task, statements)),
      text: {
        format: {
          type: 'json_schema',
          name: 'genealogy_outline',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['order'],
            properties: {
              order: { type: 'array', items: { type: 'integer' } },
            },
          },
        },
      },
    }),
  });
  if (!response.ok) return;
  const envelope = providerEnvelope.safeParse(await readBody(response, 65536));
  if (!envelope.success) return;
  const content = envelope.data.output
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? []);
  if (content.some((part) => part.type === 'refusal')) return;
  const output = content.find((part) => part.type === 'output_text')?.text;
  if (output) return applyOutline(statements, JSON.parse(output));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers });
  if (request.method !== 'POST')
    return reply(405, { error: 'Method not supported.' });
  const jwt = request.headers
    .get('authorization')
    ?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!jwt) return reply(401, { error: 'Sign in to use the assistant.' });
  try {
    const url = Deno.env.get('SUPABASE_URL'),
      anon = Deno.env.get('SUPABASE_ANON_KEY'),
      secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !secret)
      return reply(503, { error: 'The assistant is unavailable.' });
    const auth = { persistSession: false, autoRefreshToken: false };
    const caller = createClient(url, anon, {
      auth,
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const actor = await caller.auth.getUser(jwt);
    const user = actor.data.user;
    if (actor.error || !user)
      return reply(401, { error: 'Sign in to use the assistant.' });
    let body: unknown;
    try {
      body = await readBody(request, 24000);
    } catch {
      return reply(400, { error: 'Send a valid assistant request.' });
    }
    if (!body)
      return reply(413, { error: 'The assistant request is too large.' });
    const parsed = input.safeParse(body);
    if (!parsed.success)
      return reply(400, {
        error:
          'Choose the required profiles or supply up to 6,000 characters of document text.',
      });
    const service = createClient(url, secret, { auth });
    const reserve = async (live: boolean) => {
      const result = await service.rpc('reserve_assistant_request', {
        p_actor: user.id,
        p_live: live,
      });
      if (result.error) throw result.error;
      return result.data === true;
    };
    if (!(await reserve(false)))
      return reply(429, {
        error:
          'You reached today’s assistant limit. Try again after midnight UTC.',
      });
    const { tree, people, task, document } = parsed.data;
    const evidence = await caller.rpc('get_assistant_evidence', {
      p_tree: tree,
      p_people: people,
      p_task: task,
    });
    if (evidence.error?.code === '42501')
      return reply(403, {
        error: 'You do not have access to this tree or profile.',
      });
    if (evidence.error?.code === '22023')
      return reply(400, { error: 'Choose the required profiles.' });
    if (evidence.error)
      return reply(503, { error: 'Could not load the selected evidence.' });
    const checked = context.safeParse(evidence.data);
    if (!checked.success)
      return reply(503, { error: 'The tree returned unsupported evidence.' });
    const required =
      task === 'relationship'
        ? 2
        : ['gaps', 'biography', 'matches'].includes(task)
          ? 1
          : 0;
    if (checked.data.people.length < required)
      return reply(403, { error: 'A selected profile is unavailable.' });
    const statements = createStatements(task, checked.data, document);
    const key = Deno.env.get('OPENAI_API_KEY'),
      model = Deno.env.get('ASSISTANT_OPENAI_MODEL');
    if (key && model && task !== 'relationship' && statements.length > 1) {
      try {
        if (await reserve(true)) {
          const arranged = await organize(task, statements, key, model);
          if (arranged)
            return reply(200, { mode: 'live', statements: arranged });
        }
      } catch {
        // Incomplete or unusable provider responses fall back to the grounded local result.
      }
      return reply(200, { mode: 'fallback', statements });
    }
    return reply(200, { mode: 'mock', statements });
  } catch {
    return reply(503, { error: 'The assistant is unavailable. Try again.' });
  }
});
