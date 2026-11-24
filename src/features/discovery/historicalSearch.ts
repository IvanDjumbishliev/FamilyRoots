import { z } from 'zod';

export const recordTypes = [
  'birth',
  'marriage',
  'death',
  'census',
  'migration',
] as const;
export const typeLabels = {
  birth: 'Birth',
  marriage: 'Marriage',
  death: 'Death',
  census: 'Census',
  migration: 'Migration',
  all: 'All records',
};
const historicalYears = { min: 1600, max: 1925 };
const optionalYear = z
  .string()
  .trim()
  .refine((year) => !year || /^\d{4}$/u.test(year), 'Enter a four-digit year.');
export const searchForm = z
  .object({
    name: z.string().trim().min(2, 'Enter at least two characters.').max(120),
    place: z.string().trim().max(120),
    from: optionalYear,
    to: optionalYear,
    type: z.enum(['all', ...recordTypes]),
  })
  .transform(({ from, to, ...rest }) => ({
    ...rest,
    from: from ? Number(from) : historicalYears.min,
    to: to ? Number(to) : historicalYears.max,
  }))
  .superRefine(({ from, to }, ctx) => {
    if (from < historicalYears.min || from > historicalYears.max)
      ctx.addIssue({
        path: ['from'],
        code: 'custom',
        message: 'Use a year from 1600 through 1925.',
      });
    if (to < historicalYears.min || to > historicalYears.max)
      ctx.addIssue({
        path: ['to'],
        code: 'custom',
        message: 'Use a year from 1600 through 1925.',
      });
    else if (from > to)
      ctx.addIssue({
        path: ['to'],
        code: 'custom',
        message: 'End year must be at or after the start year.',
      });
  });
export type HistoricalQuery = z.output<typeof searchForm>;

export const recordSchema = z.object({
  provider: z.string().min(1).max(80),
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(220),
  name: z.string().min(1).max(120),
  place: z.string().max(120),
  year: z.number().int().min(historicalYears.min).max(historicalYears.max),
  type: z.enum(recordTypes),
  collection: z.string().min(1).max(200),
  locator: z.string().min(1).max(180),
  url: z.url({ protocol: /^https$/u }),
  license: z.string().min(1).max(120),
  retrievedAt: z.iso.datetime({ offset: true }),
  fictional: z.boolean(),
});
export type HistoricalRecord = z.infer<typeof recordSchema>;

export interface GenealogyProvider {
  readonly id: string;
  readonly name: string;
  readonly terms: {
    cache: 'none' | { ttlSeconds: number };
    allowSaving: boolean;
  };
  /**
   * Use an authenticated server transport. The provider backend owns credentials,
   * privacy filtering, licensing decisions and per-provider rate limits.
   */
  search(query: HistoricalQuery): Promise<unknown>;
}

export type SearchHit = {
  record: HistoricalRecord;
  attributions: HistoricalRecord[];
  allowSaving: boolean;
};
const normalized = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
export function recordKey(record: HistoricalRecord) {
  return JSON.stringify([
    record.fictional,
    record.year,
    record.type,
    ...[record.name, record.place, record.collection, record.locator].map(
      normalized,
    ),
  ]);
}

export class ProviderError extends Error {}
export function createHistoricalSearch(
  providers: readonly GenealogyProvider[],
) {
  return async function search(query: HistoricalQuery) {
    const settled = await Promise.allSettled(
      providers.map(async (provider) => {
        const records = z
          .array(recordSchema)
          .max(50)
          .parse(await provider.search(query));
        if (records.some((record) => record.provider !== provider.id))
          throw new ProviderError('Unexpected provider attribution.');
        return records;
      }),
    );
    const hits = new Map<string, SearchHit>();
    const errors: { provider: string; message: string }[] = [];
    settled.forEach((result, index) => {
      const provider = providers[index];
      if (result.status === 'rejected') {
        errors.push({
          provider: provider.name,
          message:
            result.reason instanceof ProviderError
              ? result.reason.message
              : 'Unable to load records. Try again.',
        });
        return;
      }
      for (const record of result.value) {
        const key = recordKey(record);
        const prior = hits.get(key);
        if (!prior) {
          hits.set(key, {
            record,
            attributions: [record],
            allowSaving: provider.terms.allowSaving,
          });
        } else if (
          !prior.attributions.some(
            (source) =>
              source.provider === record.provider && source.id === record.id,
          )
        ) {
          prior.attributions.push(record);
        }
      }
    });
    return {
      hits: [...hits.values()].sort((a, b) => a.record.year - b.record.year),
      errors,
    };
  };
}
