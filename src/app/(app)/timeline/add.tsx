import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { ActionLink } from '@/components/ActionLink';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { Screen } from '@/components/Screen';
import { usePeopleQuery } from '@/features/people/usePeople';
import { TimelineEditor } from '@/features/timeline/TimelineEditor';
import { useTimeline } from '@/features/timeline/useTimeline';
import { isRecordId } from '@/services/peopleRepository';
import type { TimelineRepository } from '@/services/timelineRepository';

export default function AddEventRoute() {
  const { repository, treeId } = useTimeline();
  const params = useLocalSearchParams<{ treeId?: string }>();
  const tree = isRecordId(params.treeId) ? params.treeId : treeId;
  if (!repository || !tree) return <Redirect href="/timeline" />;
  return <AddEvent repository={repository} treeId={tree} />;
}

function AddEvent({
  repository,
  treeId,
}: {
  repository: TimelineRepository;
  treeId: string;
}) {
  const router = useRouter();
  const read = useCallback(
    () => repository.context(treeId),
    [repository, treeId],
  );
  const query = usePeopleQuery(read);
  if (query.data && !query.data.canEdit)
    return <Redirect href={{ pathname: '/timeline', params: { treeId } }} />;
  if (!query.data)
    return (
      <Screen>
        <ActionLink
          href={{ pathname: '/timeline', params: { treeId } }}
          label="Back to timeline"
          variant="quiet"
          dismissTo
        />
        {query.error ? (
          <ErrorState message={query.error} onRetry={query.reload} />
        ) : (
          <LoadingState label="Checking permissions…" />
        )}
      </Screen>
    );
  return (
    <TimelineEditor
      repository={repository}
      treeId={treeId}
      context={query.data}
      onSaved={(eventId) =>
        router.replace({ pathname: '/timeline/[eventId]', params: { eventId } })
      }
    />
  );
}
