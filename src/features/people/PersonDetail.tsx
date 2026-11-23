import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, View } from 'react-native';
import { z } from 'zod';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { MemoryFileField } from '@/features/family/MemoryFileField';
import type { MemoryFile } from '@/features/family/memoryFile';
import { CollaborationThread } from '@/features/collaboration/Thread';
import { ReviewProposal } from '@/features/collaboration/ReviewProposal';
import { useSave } from '@/features/family/useSave';
import {
  formatHistoricalDate,
  livingOptions,
  sourceForm,
  verificationOptions,
} from '@/features/people/personForm';
import { PersonRelationships } from '@/features/relationships/PersonRelationships';
import { usePeopleQuery } from '@/features/people/usePeople';
import type {
  ConnectedPerson,
  PeopleRepository,
} from '@/services/peopleRepository';

export function PersonDetail({
  repository,
  personId,
  addRelative,
}: {
  repository: PeopleRepository;
  personId: string;
  addRelative?: boolean;
}) {
  const router = useRouter();
  const read = useCallback(
    () => repository.person(personId),
    [repository, personId],
  );
  const result = usePeopleQuery(read);
  return (
    <Screen>
      <ActionLink
        href={
          result.data
            ? {
                pathname: '/family-tree',
                params: { treeId: result.data.person.tree_id },
              }
            : '/family-tree'
        }
        label="Back to Family Tree"
        variant="quiet"
        dismissTo
      />
      {result.error ? (
        <ErrorState message={result.error} onRetry={result.reload} />
      ) : result.data ? (
        <Profile
          key={result.data.person.id}
          person={result.data.person}
          canEdit={result.data.canEdit}
          repository={repository}
          reload={result.reload}
          addRelative={addRelative}
          clearAddRelative={() => router.setParams({ addRelative: undefined })}
        />
      ) : (
        <LoadingState label="Loading person…" />
      )}
    </Screen>
  );
}

function Profile({
  person,
  canEdit,
  repository,
  reload,
  addRelative,
  clearAddRelative,
}: {
  person: ConnectedPerson;
  canEdit: boolean;
  repository: PeopleRepository;
  reload: () => void;
  addRelative?: boolean;
  clearAddRelative: () => void;
}) {
  const read = useCallback(
    () => repository.details(person),
    [repository, person],
  );
  const details = usePeopleQuery(read);
  const [confirm, setConfirm] = useState(false);
  const [sourceDiscussion, setSourceDiscussion] = useState<string>();
  const [photoError, setPhotoError] = useState(false);
  const request = useSave();
  const editable = canEdit && !person.archived_at;
  const birthDate = formatHistoricalDate(
    person.birth_date,
    person.birth_date_precision,
  );
  const deathDate = formatHistoricalDate(
    person.death_date,
    person.death_date_precision,
  );
  const fields = [
    ['Given names', person.given_names],
    ['Surnames', person.surnames],
    ['Birth name', person.birth_name],
    ['Alternative names', person.alternative_names.join(', ')],
    ['Gender identity', person.gender_identity],
    [
      'Birth date',
      birthDate &&
        (person.birth_date_approximate ? `About ${birthDate}` : birthDate),
    ],
    ['Birth place', person.birth_place],
    [
      'Death date',
      deathDate &&
        (person.death_date_approximate ? `About ${deathDate}` : deathDate),
    ],
    ['Death place', person.death_place],
    ['Occupation', person.occupation],
    ['Nationality', person.nationality],
    ['Biography', person.biography],
    ['Notes', person.notes],
  ];
  const status = livingOptions.find(
    (option) => option.value === person.living_status,
  )?.label;
  const verification = verificationOptions.find(
    (option) => option.value === person.verification_status,
  )?.label;

  return (
    <>
      <PageHeading
        title={person.display_name}
        description={`${status} · ${verification}${person.archived_at ? ' · Archived' : person.is_draft ? ' · Draft' : ''}`}
      />
      <Card>
        <Type variant="heading">Profile</Type>
        {details.data?.photoUri && !photoError && (
          <Image
            source={{ uri: details.data.photoUri }}
            accessibilityLabel={`Photograph of ${person.display_name}`}
            resizeMode="contain"
            style={{ width: '100%', height: 260 }}
            onError={() => setPhotoError(true)}
          />
        )}
        {(details.data?.photoUnavailable || photoError) && (
          <ErrorState
            message="Couldn’t load the photograph."
            onRetry={() => {
              setPhotoError(false);
              details.reload();
            }}
          />
        )}
        {fields
          .filter(([, value]) => Boolean(value))
          .map(([label, value]) => (
            <View key={label} style={{ gap: 3 }}>
              <Type variant="label" tone="muted">
                {label}
              </Type>
              <Type>{value}</Type>
            </View>
          ))}
        {editable && (
          <ActionLink
            href={{
              pathname: '/family-tree/[personId]/edit',
              params: { personId: person.id },
            }}
            label="Edit person"
          />
        )}
        {canEdit && (
          <Button
            label={person.archived_at ? 'Restore person' : 'Archive person'}
            variant="secondary"
            onPress={() => setConfirm(true)}
          />
        )}
        {request.error && (
          <ErrorState
            message="Couldn’t change archive status. Reload the person and try again."
            onRetry={reload}
          />
        )}
      </Card>

      {editable && (
        <Card>
          <ReviewProposal
            treeId={person.tree_id}
            target="people"
            id={person.id}
          />
        </Card>
      )}
      <CollaborationThread
        treeId={person.tree_id}
        target="person_id"
        id={person.id}
        canEdit={editable}
      />

      <PersonRelationships
        personId={person.id}
        treeId={person.tree_id}
        canEdit={editable}
        addRelative={addRelative}
        clearAddRelative={clearAddRelative}
      />

      {editable && (
        <PhotoForm
          onSave={async (file) => {
            await repository.attachPhoto(person, {
              name: file.name,
              mimeType: file.mimeType,
              bytes: await file.getBytes(),
            });
            setPhotoError(false);
            reload();
          }}
        />
      )}

      <Card>
        <Type variant="heading">Sources</Type>
        {details.error ? (
          <ErrorState message={details.error} onRetry={details.reload} />
        ) : !details.data ? (
          <LoadingState label="Loading sources…" />
        ) : details.data.sources.length ? (
          details.data.sources.map((citation) => (
            <View key={citation.id} style={{ gap: 4 }}>
              <Type variant="label">{citation.sources?.title}</Type>
              {citation.sources?.reference_url && (
                <Type tone="muted">{citation.sources.reference_url}</Type>
              )}
              {citation.locator && <Type tone="muted">{citation.locator}</Type>}
              {citation.sources && (
                <>
                  <Button
                    label={
                      sourceDiscussion === citation.source_id
                        ? 'Hide source discussion'
                        : `Discuss ${citation.sources.title}`
                    }
                    variant="quiet"
                    onPress={() =>
                      setSourceDiscussion(
                        sourceDiscussion === citation.source_id
                          ? undefined
                          : citation.source_id,
                      )
                    }
                  />
                  {sourceDiscussion === citation.source_id && (
                    <CollaborationThread
                      treeId={person.tree_id}
                      target="source_id"
                      id={citation.source_id}
                      canEdit={editable}
                    />
                  )}
                </>
              )}
            </View>
          ))
        ) : (
          <Type tone="muted">No sources attached.</Type>
        )}
        {editable && (
          <SourceForm
            onSave={async (values) => {
              await repository.addSource(person, values);
              details.reload();
            }}
          />
        )}
      </Card>

      <Card>
        <Type variant="heading">Recent edits</Type>
        {details.data?.activity.length ? (
          details.data.activity.map((entry) => (
            <View key={entry.id} style={{ gap: 4 }}>
              <Type variant="label">
                {entry.operation === 'insert'
                  ? 'Person created'
                  : entry.changed_fields.includes('archived_at')
                    ? 'Archive status changed'
                    : 'Profile updated'}
              </Type>
              {entry.changed_fields.length > 0 && (
                <Type variant="detail" tone="muted">
                  {entry.changed_fields
                    .map((field) => field.replaceAll('_', ' '))
                    .join(', ')}
                </Type>
              )}
              <Type variant="detail" tone="muted">
                {new Date(entry.created_at).toLocaleString()}
              </Type>
            </View>
          ))
        ) : (
          <Type tone="muted">
            {details.data
              ? 'No profile edits recorded yet.'
              : 'Edit history loads with the profile.'}
          </Type>
        )}
      </Card>

      <Dialog
        open={confirm}
        title={
          person.archived_at ? 'Restore this person?' : 'Archive this person?'
        }
        onClose={() => setConfirm(false)}
      >
        <Type>
          {person.archived_at
            ? 'This profile will return to its previous list.'
            : 'This person will move out of the active or draft list. Their information, relationships, and sources will be kept.'}
        </Type>
        <Button
          label={
            request.saving
              ? 'Saving…'
              : person.archived_at
                ? 'Confirm restore'
                : 'Confirm archive'
          }
          disabled={request.saving}
          onPress={() => {
            void request.save(
              () => repository.setArchived(person, !person.archived_at),
              () => {
                setConfirm(false);
                reload();
              },
            );
          }}
        />
        {request.error && (
          <Type tone="danger" accessibilityRole="alert">
            Couldn’t save the change. Close this dialog and reload the profile.
          </Type>
        )}
      </Dialog>
    </>
  );
}

function PhotoForm({
  onSave,
}: {
  onSave: (file: MemoryFile) => Promise<void>;
}) {
  const [file, setFile] = useState<MemoryFile>();
  const [error, setError] = useState('');
  const request = useSave();
  return (
    <Card>
      <Type variant="heading">Profile photograph</Type>
      <Type tone="muted">
        JPEG, PNG, WebP, or GIF up to 10 MB. Only authorized tree members can
        view it in the app.
      </Type>
      <MemoryFileField
        imagesOnly
        file={file}
        onFile={(next) => {
          setFile(next);
          setError('');
        }}
        onError={(message) => {
          setFile(undefined);
          setError(message);
        }}
      />
      {(error || request.error) && (
        <Type tone="danger" accessibilityRole="alert">
          {error || 'Couldn’t attach the photograph. Try again.'}
        </Type>
      )}
      <Button
        label={request.saving ? 'Uploading…' : 'Attach photograph'}
        disabled={!file || request.saving}
        onPress={() => {
          if (file)
            void request.save(
              () => onSave(file),
              () => setFile(undefined),
            );
        }}
      />
    </Card>
  );
}

function SourceForm({
  onSave,
}: {
  onSave: (source: z.output<typeof sourceForm>) => Promise<void>;
}) {
  const [values, setValues] = useState({ title: '', url: '', locator: '' });
  const [submitted, setSubmitted] = useState(false);
  const request = useSave();
  const parsed = sourceForm.safeParse(values);
  const errors =
    submitted && !parsed.success
      ? z.flattenError(parsed.error).fieldErrors
      : {};
  function change(field: keyof typeof values, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  return (
    <View style={{ gap: 10 }}>
      <TextField
        label="Source title"
        value={values.title}
        maxLength={255}
        onChangeText={(value) => change('title', value)}
        error={errors.title?.[0]}
      />
      <TextField
        label="Source URL (optional)"
        value={values.url}
        autoCapitalize="none"
        onChangeText={(value) => change('url', value)}
        error={errors.url?.[0]}
      />
      <TextField
        label="Page or reference (optional)"
        value={values.locator}
        maxLength={255}
        onChangeText={(value) => change('locator', value)}
        error={errors.locator?.[0]}
      />
      {request.error && (
        <Type tone="danger" accessibilityRole="alert">
          Couldn’t save this source. Try again.
        </Type>
      )}
      <Button
        label={request.saving ? 'Saving…' : 'Add source'}
        variant="secondary"
        disabled={request.saving}
        onPress={() => {
          setSubmitted(true);
          if (parsed.success)
            void request.save(
              () => onSave(parsed.data),
              () => {
                setValues({ title: '', url: '', locator: '' });
                setSubmitted(false);
              },
            );
        }}
      />
    </View>
  );
}
