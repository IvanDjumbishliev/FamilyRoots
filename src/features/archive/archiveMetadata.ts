import { z } from 'zod';

import {
  formatHistoricalDate,
  parseHistoricalDate,
} from '@/features/people/personForm';
import type { Tables } from '@/types/database';

export const archiveMimeTypes = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'text/plain',
] as const;
export const archiveSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(200),
  description: z.string().trim().max(4000),
  collection: z.string().trim().max(120),
  location: z.string().trim().max(240),
  sourceNote: z.string().trim().max(2000),
  eventId: z.string(),
  date: z
    .string()
    .trim()
    .refine(
      (value) => parseHistoricalDate(value) !== undefined,
      'Enter YYYY, YYYY-MM, or YYYY-MM-DD.',
    ),
  approximate: z.boolean(),
  people: z.array(z.string()).max(50, 'Choose up to 50 people.'),
});

export type ArchiveMetadata = z.input<typeof archiveSchema>;
type Item = Tables<'archive_items'>;

export function archiveDefaults(
  item?: Item,
  people: string[] = [],
): ArchiveMetadata {
  return {
    title: item?.title ?? '',
    description: item?.description ?? '',
    collection: item?.collection ?? '',
    location: item?.location ?? '',
    sourceNote: item?.source_note ?? '',
    eventId: item?.event_id ?? '',
    date: item
      ? formatHistoricalDate(item.recorded_on, item.date_precision)
      : '',
    approximate: item?.date_approximate ?? false,
    people,
  };
}

export function serializeArchiveMetadata(value: ArchiveMetadata) {
  const { date, approximate, people, ...fields } = value;
  const parsed = parseHistoricalDate(date);
  return {
    people,
    meta: {
      ...fields,
      recordedOn: parsed?.date,
      precision: parsed?.precision ?? 'unknown',
      approximate: Boolean(parsed?.date && approximate),
    },
  };
}
