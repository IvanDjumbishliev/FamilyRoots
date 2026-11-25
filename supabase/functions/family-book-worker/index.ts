import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { z } from 'npm:zod@4.3.6';

import {
  buildSections,
  sampleContext,
  sectionKeys,
  type BookContext,
} from './book.ts';
import { renderPdf } from './pdf.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const settingsSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    subtitle: z.string().max(220).optional().default(''),
    author: z.string().max(120).optional().default(''),
    copyright: z.string().max(800).optional().default(''),
    dedication: z.string().max(1200).optional().default(''),
    acknowledgments: z.string().max(1200).optional().default(''),
    template: z
      .enum(['classic-heritage', 'modern-minimal', 'vintage-archive'])
      .optional()
      .default('classic-heritage'),
    fontTheme: z
      .enum(['serif', 'sans', 'editorial'])
      .optional()
      .default('serif'),
    language: z.enum(['en', 'es', 'bg']),
    theme: z.enum(['forest', 'ink', 'sepia', 'rose', 'slate']),
    branch: z.string().uuid().nullable().optional(),
    sample: z.boolean(),
    privacy: z.enum(['private', 'full']),
    consent: z.boolean(),
    biographies: z.array(z.string().uuid()).max(100),
    events: z.array(z.string().uuid()).max(100),
    media: z.array(z.string().uuid()).max(10),
    mediaCaptions: z.record(z.string(), z.string().max(500)).optional(),
  })
  .refine(
    (value) => value.privacy === 'private' || value.consent,
    'Provide sharing consent.',
  );
const sectionsSchema = z
  .array(
    z.object({
      key: z.enum(sectionKeys),
      title: z.string().max(180),
      paragraphs: z.array(z.string().max(20000)).max(400),
      edit: z.string().max(20000).optional(),
      mediaIds: z.array(z.string()).max(10).optional(),
      photos: z
        .array(
          z.object({
            id: z.string(),
            caption: z.string().max(500).optional(),
          }),
        )
        .max(10)
        .optional(),
    }),
  )
  .max(sectionKeys.length * 2);
const requestSchema = z.strictObject({ bookId: z.string().uuid() });
const workerSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      tree_id: z.string().uuid(),
      lease: z.string().uuid(),
      status: z.literal('working'),
      operation: z.enum(['draft', 'section', 'pdf']),
      revision: z.number().int(),
      settings: z.unknown(),
      sections: z.unknown(),
      section_key: z.string().nullable(),
      pdf_path: z.string().nullable(),
    }),
  )
  .max(1);
const safeErrors = new Set([
  'The PDF exceeds 190 pages. Shorten edited sections or narrow the selection.',
  'This selection has more than 100 profiles. Choose a smaller branch.',
  'The PDF exceeds 10 MB. Select fewer images and retry.',
  'This section is no longer available.',
  'This selection has more than 150 source references. Choose a smaller branch or fewer events.',
]);
function reply(status: number, body: object) {
  return new Response(JSON.stringify(body), { status, headers });
}

async function sameSecret(offered: string, expected: string) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all(
    [offered, expected].map(
      async (secret) =>
        new Uint8Array(
          await crypto.subtle.digest('SHA-256', encoder.encode(secret)),
        ),
    ),
  );
  let delta = 0;
  for (let i = 0; i < a.length; i++) delta |= a[i] ^ b[i];
  return delta === 0;
}
async function work(service: ReturnType<typeof createClient>, bookId?: string) {
  const result = await service.rpc('claim_family_book', { p_id: bookId });
  if (result.error) throw result.error;
  const [job] = workerSchema.parse(result.data);
  if (!job) return;
  const finish = async (
    sections?: z.infer<typeof sectionsSchema>,
    path?: string,
    error?: string,
    snapshot?: BookContext,
  ) => {
    const result = await service.rpc('finish_family_book', {
      p_id: job.id,
      p_lease: job.lease,
      p_sections: sections,
      p_pdf: path,
      p_error: error,
      p_snapshot: snapshot,
    });
    if (result.error) throw result.error;
    return result.data === true;
  };
  let uploaded: string | undefined;
  try {
    const settings = settingsSchema.safeParse(job.settings);
    if (!settings.success) {
      await finish(
        undefined,
        undefined,
        'Check the book title, selections, and privacy settings and create a new draft.',
      );
      return;
    }
    // Recheck the creator’s membership before any service-role data or media read.
    const context = await service.rpc('get_family_book_context', {
      p_id: job.id,
      p_lease: job.lease,
    });
    if (context.error) throw context.error;
    const data = settings.data.sample
      ? sampleContext(settings.data.privacy === 'private')
      : (context.data as BookContext);
    if (!data || (job.operation !== 'pdf' && data.people.length > 100))
      throw new Error(
        'This selection has more than 100 profiles. Choose a smaller branch.',
      );
    if (job.operation !== 'pdf' && data.sources.length > 150)
      throw new Error(
        'This selection has more than 150 source references. Choose a smaller branch or fewer events.',
      );
    let sections = sectionsSchema.parse(job.sections);
    if (job.operation === 'draft')
      sections = buildSections(settings.data as any, data);
    if (job.operation === 'section') {
      const updated = buildSections(settings.data as any, data).find(
        (section) => section.key === job.section_key,
      );
      if (!updated) throw new Error('This section is no longer available.');
      sections = sections.map((section) =>
        section.key === updated.key ? updated : section,
      );
    }
    if (job.operation === 'pdf') {
      // Use the tree archive thumbnails only; external URLs and documents are never fetched.
      const bytes = await renderPdf(
        settings.data as any,
        sections,
        data.media,
        async (item) => {
          if (
            !item.mime.startsWith('image/') ||
            !item.path?.startsWith(job.tree_id + '/')
          )
            return;
          const { data: blob, error } = await service.storage
            .from('family-archive')
            .download(item.path);
          if (!error && blob && blob.size <= 300000)
            return new Uint8Array(await blob.arrayBuffer());
        },
      );
      if (bytes.length > 10 * 1024 * 1024)
        throw new Error(
          'The PDF exceeds 10 MB. Select fewer images and retry.',
        );
      const path = `${job.tree_id}/${job.id}/${job.revision}-${job.lease}.pdf`;
      const report = await service.storage
        .from('family-books')
        .upload(path, bytes, {
          contentType: 'application/pdf',
          cacheControl: '0',
        });
      if (report.error) throw report.error;
      uploaded = path;
    }
    const saved = await finish(
      sections,
      uploaded,
      undefined,
      job.operation === 'draft' ? data : undefined,
    );
    if (saved && job.pdf_path && job.pdf_path !== uploaded)
      await service.storage.from('family-books').remove([job.pdf_path]);
    if (!saved && uploaded)
      await service.storage.from('family-books').remove([uploaded]);
  } catch (error) {
    if (uploaded) {
      const latest = await service
        .from('family_books')
        .select('pdf_path')
        .eq('id', job.id)
        .maybeSingle();
      if (!latest.error && latest.data?.pdf_path !== uploaded)
        await service.storage.from('family-books').remove([uploaded]);
    }
    const message =
      error instanceof Error && safeErrors.has(error.message)
        ? error.message
        : 'Book generation failed. Retry the job or check tree access.';
    await finish(undefined, undefined, message);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers });
  if (request.method !== 'POST')
    return reply(405, { error: 'Method not supported.' });
  try {
    const url = Deno.env.get('SUPABASE_URL'),
      anon = Deno.env.get('SUPABASE_ANON_KEY'),
      secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !secret)
      return reply(503, { error: 'Book worker unavailable.' });
    const auth = { persistSession: false, autoRefreshToken: false };
    const service = createClient(url, secret, { auth });
    const scheduleSecret = Deno.env.get('BOOK_WORKER_SECRET');
    const offered = request.headers.get('x-book-worker-secret');
    if (
      scheduleSecret &&
      offered &&
      (await sameSecret(offered, scheduleSecret))
    ) {
      EdgeRuntime.waitUntil(work(service).catch(() => undefined));
      return reply(202, { accepted: true });
    }
    const jwt = request.headers
      .get('authorization')
      ?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!jwt) return reply(401, { error: 'Sign in to open a book.' });
    const client = createClient(url, anon, {
      auth,
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const {
      data: { user },
      error,
    } = await client.auth.getUser(jwt);
    if (error || !user) return reply(401, { error: 'Sign in to open a book.' });
    const reader = request.body?.getReader();
    const decoder = new TextDecoder();
    let text = '',
      size = 0;
    if (!reader) return reply(400, { error: 'Choose a book.' });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1024) {
        await reader.cancel();
        return reply(413, { error: 'Request too large.' });
      }
      text += decoder.decode(value, { stream: true });
    }
    let body: unknown;
    try {
      body = JSON.parse(text + decoder.decode());
    } catch {
      return reply(400, { error: 'Choose a book.' });
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return reply(400, { error: 'Choose a book.' });
    const { bookId } = parsed.data;
    const book = await client
      .from('family_books')
      .select('id')
      .eq('id', bookId)
      .eq('creator_id', user.id)
      .maybeSingle();
    if (book.error || !book.data)
      return reply(403, { error: 'This book is unavailable.' });
    EdgeRuntime.waitUntil(work(service, bookId).catch(() => undefined));
    return reply(202, { accepted: true });
  } catch {
    return reply(503, { error: 'Book worker unavailable.' });
  }
});
