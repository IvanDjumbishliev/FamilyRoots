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

export default function EditEventRoute() {
  const { repository } = useTimeline();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  if (!repository || !isRecordId(eventId)) return <Redirect href="/timeline" />;
  return <EditEvent repository={repository} eventId={eventId} />;
}

function EditEvent({
  repository,
  eventId,
}: {
  repository: TimelineRepository;
  eventId: string;
}) {
  const router = useRouter();
  const read = useCallback(async () => {
    const event = await repository.event(eventId);
    return { event, context: await repository.context(event.treeId) };
  }, [repository, eventId]);
  const query = usePeopleQuery(read);
  const detail = {
    pathname: '/timeline/[eventId]',
    params: { eventId },
  } as const;
  if (query.data && !query.data.context.canEdit)
    return <Redirect href={detail} />;
  if (!query.data)
    return (
      <Screen>
        <ActionLink
          href={detail}
          label="Back to event"
          variant="quiet"
          dismissTo
        />
        {query.error ? (
          <ErrorState message={query.error} onRetry={query.reload} />
        ) : (
          <LoadingState label="Loading event…" />
        )}
      </Screen>
    );
  return (
    <TimelineEditor
      repository={repository}
      treeId={query.data.event.treeId}
      context={query.data.context}
      existing={query.data.event}
      onSaved={() => router.dismissTo(detail)}
    />
  );
}
