import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { Screen } from '@/components/Screen';
import { PersonEditor } from '@/features/people/PersonEditor';
import { usePeople, usePeopleQuery } from '@/features/people/usePeople';
import { isRecordId, type PeopleRepository } from '@/services/peopleRepository';

export default function PersonEditRoute() {
  const { repository } = usePeople();
  const { personId } = useLocalSearchParams<{ personId?: string }>();
  if (!repository || !isRecordId(personId))
    return <Redirect href="/family-tree" />;
  return <EditPerson repository={repository} id={personId} />;
}

function EditPerson({
  repository,
  id,
}: {
  repository: PeopleRepository;
  id: string;
}) {
  const router = useRouter();
  const read = useCallback(() => repository.person(id), [repository, id]);
  const result = usePeopleQuery(read);
  if (result.error || !result.data) {
    return (
      <Screen>
        {result.error ? (
          <ErrorState message={result.error} onRetry={result.reload} />
        ) : (
          <LoadingState label="Loading person…" />
        )}
      </Screen>
    );
  }
  const { person, canEdit } = result.data;
  if (!canEdit || person.archived_at)
    return (
      <Redirect
        href={{ pathname: '/family-tree/[personId]', params: { personId: id } }}
      />
    );
  return (
    <PersonEditor
      key={id}
      person={person}
      write={async (values) => {
        await repository.update(person, values);
        return id;
      }}
      onSaved={() =>
        router.dismissTo({
          pathname: '/family-tree/[personId]',
          params: { personId: id },
        })
      }
    />
  );
}
