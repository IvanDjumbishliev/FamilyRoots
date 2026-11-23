import { z } from 'zod';

import type { Tables, TablesInsert } from '../../types/database';

type Person = Tables<'people'>;
export const livingOptions = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'living', label: 'Living' },
  { value: 'deceased', label: 'Deceased' },
] as const;
export const verificationOptions = [
  { value: 'unverified', label: 'Unverified' },
  { value: 'verified', label: 'Verified' },
  { value: 'disputed', label: 'Disputed' },
] as const;

export function parseHistoricalDate(input: string) {
  const value = input.trim();
  if (!value) return { date: null, precision: 'unknown' } as const;
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match || Number(match[1]) === 0) return undefined;
  const [, year, month, day] = match;
  const date = `${year}-${month ?? '01'}-${day ?? '01'}`;
  const time = new Date(`${date}T00:00:00.000Z`);
  if (
    !Number.isFinite(time.getTime()) ||
    time.toISOString().slice(0, 10) !== date
  )
    return undefined;
  return { date, precision: day ? 'day' : month ? 'month' : 'year' } as const;
}

export function formatHistoricalDate(
  date: string | null,
  precision: Person['birth_date_precision'],
) {
  if (!date || precision === 'unknown') return '';
  return date.slice(
    0,
    precision === 'year' ? 4 : precision === 'month' ? 7 : 10,
  );
}

const shortText = (max: number) => z.string().trim().max(max);
const dateText = z
  .string()
  .trim()
  .refine(
    (input) => parseHistoricalDate(input) !== undefined,
    'Enter a real date as YYYY, YYYY-MM, or YYYY-MM-DD.',
  );

export const personFields = z.object({
  givenNames: shortText(160),
  surnames: shortText(160),
  birthName: shortText(160),
  alternativeNames: z
    .string()
    .transform((value) =>
      value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .pipe(
      z.array(z.string().max(160)).max(20, 'Enter up to 20 alternative names.'),
    ),
  genderIdentity: shortText(100),
  birthDate: dateText,
  birthApproximate: z.boolean(),
  birthPlace: shortText(240),
  deathDate: dateText,
  deathApproximate: z.boolean(),
  deathPlace: shortText(240),
  livingStatus: z.enum(['unknown', 'living', 'deceased']),
  biography: shortText(10000),
  occupation: shortText(160),
  nationality: shortText(160),
  notes: shortText(10000),
  verificationStatus: z.enum(['unverified', 'verified', 'disputed']),
});

export type PersonFormValues = z.input<typeof personFields>;
export type PersonChanges = Omit<
  TablesInsert<'people'>,
  'tree_id' | 'id' | 'created_at' | 'updated_at'
>;

export function personDefaults(person?: Person): PersonFormValues {
  return {
    givenNames:
      person?.given_names ??
      (person && !person.surnames && person.display_name !== 'Unnamed draft'
        ? person.display_name
        : ''),
    surnames: person?.surnames ?? '',
    birthName: person?.birth_name ?? '',
    alternativeNames: person?.alternative_names.join('\n') ?? '',
    genderIdentity: person?.gender_identity ?? '',
    birthDate: person
      ? formatHistoricalDate(person.birth_date, person.birth_date_precision)
      : '',
    birthApproximate: person?.birth_date_approximate ?? false,
    birthPlace: person?.birth_place ?? '',
    deathDate: person
      ? formatHistoricalDate(person.death_date, person.death_date_precision)
      : '',
    deathApproximate: person?.death_date_approximate ?? false,
    deathPlace: person?.death_place ?? '',
    livingStatus: person?.living_status ?? 'unknown',
    biography: person?.biography ?? '',
    occupation: person?.occupation ?? '',
    nationality: person?.nationality ?? '',
    notes: person?.notes ?? '',
    verificationStatus: person?.verification_status ?? 'unverified',
  };
}

export function validatePerson(values: PersonFormValues, draft: boolean) {
  return personFields
    .superRefine((value, ctx) => {
      if (
        [value.givenNames, value.surnames].filter(Boolean).join(' ').length >
        160
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['surnames'],
          message: 'The full name must fit within 160 characters.',
        });
      }
      if (!draft && !value.givenNames && !value.surnames) {
        ctx.addIssue({
          code: 'custom',
          path: ['givenNames'],
          message: 'Enter at least one given name or surname, or save a draft.',
        });
      }
      if (
        value.livingStatus === 'living' &&
        (value.deathDate || value.deathPlace)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['livingStatus'],
          message: 'Clear the death details or change the living status.',
        });
      }
      const birth = parseHistoricalDate(value.birthDate);
      const death = parseHistoricalDate(value.deathDate);
      if (
        birth?.date &&
        death?.date &&
        !value.birthApproximate &&
        !value.deathApproximate
      ) {
        const lastDate = new Date(`${death.date}T00:00:00Z`);
        if (death.precision === 'year') lastDate.setUTCMonth(11, 31);
        if (death.precision === 'month')
          lastDate.setUTCMonth(lastDate.getUTCMonth() + 1, 0);
        const lastPossibleDeath = lastDate.toISOString().slice(0, 10);
        if (birth.date > lastPossibleDeath) {
          ctx.addIssue({
            code: 'custom',
            path: ['deathDate'],
            message: 'The death date cannot precede the birth date.',
          });
        }
      }
    })
    .safeParse(values);
}

export function personChanges(
  values: z.output<typeof personFields>,
  draft: boolean,
): PersonChanges {
  const birth = parseHistoricalDate(values.birthDate);
  const death = parseHistoricalDate(values.deathDate);
  return {
    display_name:
      [values.givenNames, values.surnames].filter(Boolean).join(' ') ||
      'Unnamed draft',
    given_names: values.givenNames || null,
    surnames: values.surnames || null,
    birth_name: values.birthName || null,
    alternative_names: values.alternativeNames,
    gender_identity: values.genderIdentity || null,
    birth_date: birth?.date ?? null,
    birth_date_precision: birth?.precision ?? 'unknown',
    birth_date_approximate: Boolean(birth?.date && values.birthApproximate),
    birth_place: values.birthPlace || null,
    death_date: death?.date ?? null,
    death_date_precision: death?.precision ?? 'unknown',
    death_date_approximate: Boolean(death?.date && values.deathApproximate),
    death_place: values.deathPlace || null,
    living_status: values.livingStatus,
    biography: values.biography || null,
    occupation: values.occupation || null,
    nationality: values.nationality || null,
    notes: values.notes || null,
    verification_status: values.verificationStatus,
    is_draft: draft,
  };
}

export const sourceForm = z.object({
  title: z.string().trim().min(1, 'Enter a source title.').max(255),
  url: z
    .string()
    .trim()
    .refine(
      (url) => !url || z.url({ protocol: /^https?$/ }).safeParse(url).success,
      'Enter an HTTP or HTTPS address.',
    ),
  locator: z.string().trim().max(255),
});
