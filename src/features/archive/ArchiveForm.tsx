import { useState, type Dispatch, type SetStateAction } from 'react';
import { View } from 'react-native';
import type { z } from 'zod';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { useSave } from '@/features/family/useSave';
import type { ArchiveContextData } from '@/services/archiveRepository';

import { ArchivePicker } from './ArchivePicker';
import type { ArchiveMetadata, archiveSchema } from './archiveMetadata';

type Errors = z.ZodFlattenedError<z.input<typeof archiveSchema>>['fieldErrors'];

export function ArchiveForm({
  value,
  onChange,
  context,
  errors,
  createEvent,
}: {
  value: ArchiveMetadata;
  onChange: Dispatch<SetStateAction<ArchiveMetadata>>;
  context: ArchiveContextData;
  errors: Errors;
  createEvent: (title: string) => Promise<{ id: string; title: string }>;
}) {
  const [eventForm, setEventForm] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [createdEvents, setCreatedEvents] = useState<
    { id: string; title: string }[]
  >([]);
  const request = useSave();
  const events = [
    ...new Map(
      [...context.events, ...createdEvents].map((event) => [event.id, event]),
    ).values(),
  ];
  function set<Key extends keyof ArchiveMetadata>(
    key: Key,
    next: ArchiveMetadata[Key],
  ) {
    onChange((previous) => ({ ...previous, [key]: next }));
  }

  return (
    <View style={{ gap: 14 }}>
      <TextField
        label="Title"
        value={value.title}
        onChangeText={(next) => set('title', next)}
        maxLength={200}
        error={errors.title?.[0]}
      />
      <TextField
        label="Description"
        value={value.description}
        onChangeText={(next) => set('description', next)}
        maxLength={4000}
        multiline
      />
      <TextField
        label="Date"
        value={value.date}
        onChangeText={(next) => set('date', next)}
        maxLength={10}
        hint="Use YYYY, YYYY-MM, or YYYY-MM-DD. Leave blank if unknown."
        error={errors.date?.[0]}
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
        value={value.location}
        onChangeText={(next) => set('location', next)}
        maxLength={240}
      />
      <TextField
        label="Collection"
        value={value.collection}
        onChangeText={(next) => set('collection', next)}
        maxLength={120}
        hint="Use the same collection name to group items."
      />
      <TextField
        label="Source information"
        value={value.sourceNote}
        onChangeText={(next) => set('sourceNote', next)}
        maxLength={2000}
        multiline
      />
      <ArchivePicker
        label="Find family members to link"
        options={context.people.map((person) => ({
          id: person.id,
          label: person.display_name,
        }))}
        multiple
        selected={value.people}
        onToggle={(id) =>
          set(
            'people',
            value.people.includes(id)
              ? value.people.filter((person) => person !== id)
              : [...value.people, id],
          )
        }
      />
      {errors.people?.[0] && (
        <Type tone="danger" accessibilityRole="alert">
          {errors.people[0]}
        </Type>
      )}
      {events.length > 0 && (
        <ArchivePicker
          label="Find an event"
          options={events.map((event) => ({
            id: event.id,
            label: event.title,
          }))}
          selected={value.eventId ? [value.eventId] : []}
          onToggle={(id) => set('eventId', value.eventId === id ? '' : id)}
        />
      )}
      {eventForm ? (
        <View style={{ gap: 8 }}>
          <TextField
            label="New event title"
            value={eventTitle}
            maxLength={160}
            onChangeText={setEventTitle}
          />
          {request.error && (
            <Type tone="danger" accessibilityRole="alert">
              Couldn’t create the event. Try again.
            </Type>
          )}
          <Button
            label={request.saving ? 'Creating…' : 'Create and select event'}
            variant="secondary"
            disabled={request.saving || !eventTitle.trim()}
            onPress={() => {
              void request.save(
                async () => {
                  const event = await createEvent(eventTitle);
                  setCreatedEvents((previous) => [...previous, event]);
                  set('eventId', event.id);
                },
                () => {
                  setEventTitle('');
                  setEventForm(false);
                },
              );
            }}
          />
          <Button
            label="Cancel event"
            variant="quiet"
            disabled={request.saving}
            onPress={() => setEventForm(false)}
          />
        </View>
      ) : (
        <Button
          label="Create a family event"
          variant="quiet"
          onPress={() => setEventForm(true)}
        />
      )}
    </View>
  );
}
