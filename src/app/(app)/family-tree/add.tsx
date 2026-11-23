import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { z } from 'zod';

import { Card } from '@/components/Card';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { Choices } from '@/features/people/Choices';
import { demoTree } from '@/features/tree/demoTree';
import { TextField } from '@/components/TextField';
import { FormActions } from '@/features/family/FormActions';
import { useFamily } from '@/features/family/useFamily';
import { useSave } from '@/features/family/useSave';

import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PersonEditor } from '@/features/people/PersonEditor';
import { usePeople, usePeopleQuery } from '@/features/people/usePeople';
import { isRecordId, type PeopleRepository } from '@/services/peopleRepository';

export default function AddPersonScreen() {
  const { repository, firstTree } = usePeople();
  const { treeId, relativeTo } = useLocalSearchParams<{
    treeId?: string;
    relativeTo?: string;
  }>();
  const target = isRecordId(treeId) ? treeId : firstTree;
  if (repository && target)
    return <AddConnectedPerson repository={repository} treeId={target} />;
  return (
    <AddDemoPerson
      relativeTo={typeof relativeTo === 'string' ? relativeTo : undefined}
    />
  );
}

function AddConnectedPerson({
  repository,
  treeId,
}: {
  repository: PeopleRepository;
  treeId: string;
}) {
  const router = useRouter();
  const read = useCallback(
    () => repository.access(treeId),
    [repository, treeId],
  );
  const result = usePeopleQuery(read);
  if (result.error || !result.data) {
    return (
      <Screen>
        {result.error ? (
          <ErrorState message={result.error} onRetry={result.reload} />
        ) : (
          <LoadingState label="Checking tree access…" />
        )}
      </Screen>
    );
  }
  if (!result.data.canEdit)
    return <Redirect href={{ pathname: '/family-tree', params: { treeId } }} />;
  return (
    <PersonEditor
      key={treeId}
      write={(values) => repository.create(treeId, values)}
      onSaved={(personId) =>
        router.replace({
          pathname: '/family-tree/[personId]',
          params: { personId },
        })
      }
    />
  );
}

function AddDemoPerson({ relativeTo }: { relativeTo?: string }) {
  const { repository, workspace, snapshot } = useFamily();
  const router = useRouter();
  const { save, saving, error } = useSave();
  const relative = relativeTo
    ? demoTree(snapshot, workspace).people.find(
        (person) => person.id === relativeTo,
      )
    : undefined;
  const [direction, setDirection] = useState<'parent' | 'child'>('child');
  const [name, setName] = useState('');
  const [generation, setGeneration] = useState('1');
  const [birthYear, setBirthYear] = useState('');
  const [relation, setRelation] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const currentYear = new Date().getFullYear();
  const result = z
    .object({
      name: z.string().trim().min(1, 'Enter a name.').max(100),
      generation: z
        .string()
        .trim()
        .regex(/^\d{1,2}$/, 'Enter a generation from 1 to 25.')
        .transform(Number)
        .pipe(
          z
            .number()
            .min(1, 'Enter a generation from 1 to 25.')
            .max(25, 'Enter a generation from 1 to 25.'),
        ),
      birthYear: z
        .string()
        .trim()
        .refine(
          (value) =>
            !value ||
            (/^\d{4}$/.test(value) &&
              Number(value) >= 1000 &&
              Number(value) <= currentYear),
          `Enter a year from 1000 to ${currentYear}.`,
        )
        .transform((value) => (value ? Number(value) : undefined)),
      relation: z
        .string()
        .trim()
        .max(60)
        .transform((value) => value || undefined),
    })
    .safeParse({ name, generation, birthYear, relation });
  const errors =
    submitted && !result.success
      ? z.flattenError(result.error).fieldErrors
      : {};

  function submit() {
    setSubmitted(true);
    if (result.success)
      void save(
        () =>
          repository.addPerson(workspace, {
            ...result.data,
            relativeTo: relative?.id,
            relativeDirection: relative ? direction : undefined,
          }),
        () => router.dismissTo('/family-tree'),
      );
  }

  return (
    <Screen>
      <PageHeading
        title={relative ? `Add relative to ${relative.name}` : 'Add Person'}
        description={`Add a relative to ${snapshot.familyName === 'Your family' ? 'your family' : snapshot.familyName.toLowerCase()}.`}
      />
      <Card>
        {relative && (
          <Choices
            label="Relationship to selected person"
            value={direction}
            onChange={setDirection}
            choices={[
              { value: 'child', label: 'Child' },
              { value: 'parent', label: 'Parent' },
            ]}
          />
        )}
        <TextField
          label="Full name"
          value={name}
          onChangeText={setName}
          maxLength={100}
          error={errors.name?.[0]}
          autoCapitalize="words"
        />
        <TextField
          label="Generation"
          value={generation}
          onChangeText={setGeneration}
          inputMode="numeric"
          maxLength={2}
          error={errors.generation?.[0]}
          hint="Use 1 for your oldest known generation."
        />
        <TextField
          label="Birth year (optional)"
          value={birthYear}
          onChangeText={setBirthYear}
          inputMode="numeric"
          maxLength={4}
          error={errors.birthYear?.[0]}
        />
        <TextField
          label="Relationship (optional)"
          value={relation}
          onChangeText={setRelation}
          maxLength={60}
          placeholder="For example, Aunt"
        />
        <FormActions
          cancelTo="/family-tree"
          label="Save person"
          saving={saving}
          error={error}
          onSubmit={submit}
        />
      </Card>
    </Screen>
  );
}
