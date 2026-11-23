import { useState } from 'react';
import { z } from 'zod';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { ArchivePicker } from '@/features/archive/ArchivePicker';
import { useSave } from '@/features/family/useSave';
import { Choices } from '@/features/people/Choices';
import {
  formatHistoricalDate,
  parseHistoricalDate,
  sourceForm,
  verificationOptions,
} from '@/features/people/personForm';
import type {
  TimelineContextData,
  TimelineRepository,
} from '@/services/timelineRepository';

import {
  eventTypes,
  type EventType,
  type TimelineKind,
  type TimelineEvent,
} from './timelineModel';

const types = [
  'birth',
  'partnership',
  'death',
  'migration',
  'education',
  'occupation',
  'military_service',
  'residence',
  'custom',
] as const satisfies readonly EventType[];
const category = [
  { value: 'family', label: 'Family event' },
  { value: 'context', label: 'Historical context' },
] as const;
const schema = z.object({
  title: z.string().trim().min(1, 'Enter an event title.').max(160),
  type: z.enum(types),
  kind: z.enum(['family', 'context']),
  verification: z.enum(['unverified', 'verified', 'disputed']),
  date: z
    .string()
    .trim()
    .refine(
      (value) => parseHistoricalDate(value) !== undefined,
      'Enter YYYY, YYYY-MM, or YYYY-MM-DD.',
    ),
  approximate: z.boolean(),
  place: z.string().trim().max(240),
  notes: z.string().trim().max(6000),
  people: z.array(z.string()).max(100, 'Choose up to 100 people.'),
  items: z.array(z.string()).max(100, 'Choose up to 100 archive items.'),
  sources: z.array(z.string()).max(100, 'Choose up to 100 sources.'),
});
type Values = z.input<typeof schema>;

function defaults(event?: TimelineEvent): Values {
  return {
    title: event?.title ?? '',
    type: event?.type ?? 'custom',
    kind: event?.kind ?? 'family',
    verification: event?.verification ?? 'unverified',
    date: event ? formatHistoricalDate(event.date, event.precision) : '',
    approximate: event?.approximate ?? false,
    place: event?.place ?? '',
    notes: event?.notes ?? '',
    people: [...(event?.people ?? [])],
    items: [...(event?.items ?? [])],
    sources: [...(event?.sources ?? [])],
  };
}

export function TimelineEditor({
  repository,
  treeId,
  context,
  existing,
  onSaved,
}: {
  repository: TimelineRepository;
  treeId: string;
  context: TimelineContextData;
  existing?: Awaited<ReturnType<TimelineRepository['event']>>;
  onSaved: (id: string) => void;
}) {
  const [value, setValue] = useState(() => defaults(existing?.event));
  const [submitted, setSubmitted] = useState(false);
  const [createdSources, setCreatedSources] = useState<
    TimelineContextData['sources']
  >([]);
  const request = useSave();
  const parsed = schema.safeParse(value);
  const errors =
    submitted && !parsed.success
      ? z.flattenError(parsed.error).fieldErrors
      : {};
  function set<Key extends keyof Values>(field: Key, next: Values[Key]) {
    setValue((previous) => ({ ...previous, [field]: next }));
  }
  function toggle(field: 'people' | 'items' | 'sources', id: string) {
    setValue((previous) => ({
      ...previous,
      [field]: previous[field].includes(id)
        ? previous[field].filter((item) => item !== id)
        : [...previous[field], id],
    }));
  }
  function changeKind(kind: TimelineKind) {
    setValue((previous) => ({
      ...previous,
      kind,
      verification: kind === 'context' ? 'unverified' : previous.verification,
    }));
  }
  function submit() {
    setSubmitted(true);
    if (!parsed.success) return;
    const date = parseHistoricalDate(parsed.data.date);
    let result = '';
    void request.save(
      async () => {
        result = await repository.save(treeId, {
          ...parsed.data,
          id: existing?.event.id,
          version: existing?.version,
          date: date?.date,
          precision: date?.precision ?? 'unknown',
          approximate: Boolean(date?.date && parsed.data.approximate),
        });
      },
      () => onSaved(result),
    );
  }

  return (
    <Screen>
      <PageHeading
        title={existing ? 'Edit event' : 'Add timeline event'}
        description={context.name}
      />
      <Card>
        <TextField
          label="Event title"
          value={value.title}
          maxLength={160}
          onChangeText={(title) => set('title', title)}
          error={errors.title?.[0]}
        />
        <Choices
          label="Entry category"
          choices={category}
          value={value.kind}
          onChange={changeKind}
        />
        <Choices
          label="Event type"
          choices={eventTypes}
          value={value.type}
          onChange={(kind) => set('type', kind)}
        />
        {value.kind === 'family' && (
          <Choices
            label="Verification status"
            choices={verificationOptions}
            value={value.verification}
            onChange={(status) => set('verification', status)}
          />
        )}
        <TextField
          label="Event date"
          value={value.date}
          maxLength={10}
          onChangeText={(date) => set('date', date)}
          error={errors.date?.[0]}
          hint="Use YYYY, YYYY-MM, or YYYY-MM-DD. Leave blank if unknown."
        />
        <Button
          label="Approximate date"
          variant="secondary"
          accessibilityRole="checkbox"
          aria-checked={value.approximate}
          accessibilityState={{ checked: value.approximate }}
          selected={value.approximate}
          disabled={!value.date.trim()}
          onPress={() => set('approximate', !value.approximate)}
        />
        <TextField
          label="Location"
          value={value.place}
          maxLength={240}
          onChangeText={(place) => set('place', place)}
        />
        <TextField
          label="Event notes"
          value={value.notes}
          multiline
          maxLength={6000}
          onChangeText={(notes) => set('notes', notes)}
        />
      </Card>
      <Card>
        <Type variant="heading" accessibilityRole="header">
          People and evidence
        </Type>
        <ArchivePicker
          label="Find people to link"
          options={context.people.map(({ id, display_name }) => ({
            id,
            label: display_name,
          }))}
          selected={value.people}
          onToggle={(id) => toggle('people', id)}
          multiple
        />
        <ArchivePicker
          label="Find archive photos or documents"
          options={context.items.map(({ id, title }) => ({ id, label: title }))}
          selected={value.items}
          onToggle={(id) => toggle('items', id)}
          multiple
        />
        {!context.items.length && (
          <Type variant="detail" tone="muted">
            Upload photos and documents in Family Archive to link them here.
          </Type>
        )}
        <ArchivePicker
          label="Find sources to cite"
          options={[...context.sources, ...createdSources].map(
            ({ id, title }) => ({ id, label: title }),
          )}
          selected={value.sources}
          onToggle={(id) => toggle('sources', id)}
          multiple
        />
        <NewSource
          create={(title, url) => repository.createSource(treeId, title, url)}
          onCreated={(source) => {
            setCreatedSources((previous) => [...previous, source]);
            setValue((previous) => ({
              ...previous,
              sources: [...previous.sources, source.id],
            }));
          }}
        />
        {(errors.people?.[0] || errors.items?.[0] || errors.sources?.[0]) && (
          <Type tone="danger" accessibilityRole="alert">
            {errors.people?.[0] || errors.items?.[0] || errors.sources?.[0]}
          </Type>
        )}
        {request.error && (
          <Type tone="danger" accessibilityRole="alert">
            Couldn’t save the event. Check your access or reload if someone else
            edited it.
          </Type>
        )}
        <Button
          label={request.saving ? 'Saving…' : 'Save event'}
          disabled={request.saving}
          onPress={submit}
        />
        <ActionLink
          href={
            existing
              ? {
                  pathname: '/timeline/[eventId]',
                  params: { eventId: existing.event.id },
                }
              : { pathname: '/timeline', params: { treeId } }
          }
          dismissTo
          label="Cancel"
          variant="quiet"
        />
      </Card>
    </Screen>
  );
}

function NewSource({
  create,
  onCreated,
}: {
  create: (
    title: string,
    url: string,
  ) => Promise<TimelineContextData['sources'][number]>;
  onCreated: (source: TimelineContextData['sources'][number]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const request = useSave();
  const parsed = sourceForm.safeParse({ title, url, locator: '' });
  const errors =
    submitted && !parsed.success
      ? z.flattenError(parsed.error).fieldErrors
      : {};
  if (!open)
    return (
      <Button
        label="Create a source citation"
        variant="quiet"
        onPress={() => setOpen(true)}
      />
    );
  return (
    <>
      <TextField
        label="New source title"
        value={title}
        onChangeText={setTitle}
        maxLength={255}
        error={errors.title?.[0]}
      />
      <TextField
        label="New source URL (optional)"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        maxLength={1000}
        error={errors.url?.[0]}
      />
      {request.error && (
        <Type tone="danger" accessibilityRole="alert">
          Couldn’t create the source.
        </Type>
      )}
      <Button
        label={request.saving ? 'Creating…' : 'Create and cite source'}
        disabled={request.saving}
        variant="secondary"
        onPress={() => {
          setSubmitted(true);
          if (parsed.success)
            void request.save(
              async () =>
                onCreated(await create(parsed.data.title, parsed.data.url)),
              () => {
                setOpen(false);
                setTitle('');
                setUrl('');
                setSubmitted(false);
              },
            );
        }}
      />
      <Button
        label="Cancel source"
        variant="quiet"
        disabled={request.saving}
        onPress={() => setOpen(false)}
      />
    </>
  );
}
