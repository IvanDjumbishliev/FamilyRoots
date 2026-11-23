import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { Type } from '@/components/Type';
import { CollaborationThread } from '@/features/collaboration/Thread';
import { ReviewProposal } from '@/features/collaboration/ReviewProposal';
import { useSave } from '@/features/family/useSave';
import { usePeopleQuery } from '@/features/people/usePeople';
import { sourceForm } from '@/features/people/personForm';
import type {
  TimelineContextData,
  TimelineRepository,
} from '@/services/timelineRepository';

import { eventDateLabel, eventTypes } from './timelineModel';

export function TimelineDetail({
  repository,
  eventId,
}: {
  repository: TimelineRepository;
  eventId: string;
}) {
  const read = useCallback(async () => {
    const result = await repository.event(eventId);
    return { result, context: await repository.context(result.treeId) };
  }, [eventId, repository]);
  const query = usePeopleQuery(read);
  return (
    <Screen>
      <ActionLink
        href={
          query.data
            ? {
                pathname: '/timeline',
                params: { treeId: query.data.result.treeId },
              }
            : '/timeline'
        }
        label="Back to timeline"
        variant="quiet"
        dismissTo
      />
      {query.error ? (
        <ErrorState message={query.error} onRetry={query.reload} />
      ) : !query.data ? (
        <LoadingState label="Loading event…" />
      ) : (
        <EventContent key={eventId} repository={repository} {...query.data} />
      )}
    </Screen>
  );
}

function EventContent({
  repository,
  result,
  context,
}: {
  repository: TimelineRepository;
  result: Awaited<ReturnType<TimelineRepository['event']>>;
  context: TimelineContextData;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [discussion, setDiscussion] = useState<string>();
  const request = useSave();
  const { event, treeId, version } = result;
  const media = context.items.filter(
    (item) => item.event_id === event.id || event.items.includes(item.id),
  );
  const people = context.people.filter((person) =>
    event.people.includes(person.id),
  );
  const sources = context.sources.filter((source) =>
    event.sources.includes(source.id),
  );
  const type = eventTypes.find((option) => option.value === event.type)?.label;
  const status =
    event.kind === 'context'
      ? 'Historical context'
      : `Family event · ${event.verification}`;

  return (
    <>
      <PageHeading
        title={event.title}
        description={`${eventDateLabel(event)} · ${type}`}
      />
      <Card>
        <Type variant="label">{status}</Type>
        {event.place && <Type>{event.place}</Type>}
        {event.notes && <Type>{event.notes}</Type>}
        {context.canEdit && (
          <ReviewProposal treeId={treeId} target="life_events" id={event.id} />
        )}
        {context.canEdit && (
          <ActionLink
            href={{
              pathname: '/timeline/[eventId]/edit',
              params: { eventId: event.id },
            }}
            label="Edit event"
          />
        )}
        {context.canEdit && (
          <Button
            label="Remove event"
            variant="quiet"
            onPress={() => setConfirm(true)}
          />
        )}
      </Card>
      <Card>
        <Type variant="heading" accessibilityRole="header">
          People
        </Type>
        {people.length ? (
          people.map((person) => (
            <ActionLink
              key={person.id}
              href={{
                pathname: '/family-tree/[personId]',
                params: { personId: person.id },
              }}
              label={person.display_name}
              variant="quiet"
            />
          ))
        ) : (
          <Type tone="muted">No people linked.</Type>
        )}
      </Card>
      <Card>
        <Type variant="heading" accessibilityRole="header">
          Photographs and documents
        </Type>
        {media.length ? (
          media.map((item) => (
            <ActionLink
              key={item.id}
              href={{
                pathname: '/family-archive/[itemId]',
                params: { itemId: item.id },
              }}
              label={item.title}
              variant="quiet"
            />
          ))
        ) : (
          <Type tone="muted">No archive files linked.</Type>
        )}
      </Card>
      <Card>
        <Type variant="heading" accessibilityRole="header">
          Source citations
        </Type>
        {sources.length ? (
          sources.map((source) => {
            const web =
              source.reference_url &&
              sourceForm.safeParse({
                title: source.title,
                url: source.reference_url,
                locator: '',
              }).success;
            return (
              <View key={source.id} style={{ gap: 4 }}>
                <Type variant="label">{source.title}</Type>
                {result.citations
                  .filter(
                    (cite) => cite.source_id === source.id && cite.locator,
                  )
                  .map((cite, index) => (
                    <Type key={index} tone="muted">
                      {cite.locator}
                    </Type>
                  ))}
                <Button
                  label={
                    discussion === source.id
                      ? 'Hide source discussion'
                      : `Discuss ${source.title}`
                  }
                  variant="quiet"
                  onPress={() =>
                    setDiscussion(
                      discussion === source.id ? undefined : source.id,
                    )
                  }
                />
                {discussion === source.id && (
                  <CollaborationThread
                    treeId={treeId}
                    target="source_id"
                    id={source.id}
                    canEdit={context.canEdit}
                  />
                )}
                {web && (
                  <Button
                    label={`Open source ${source.title}`}
                    variant="quiet"
                    onPress={() =>
                      void request.save(
                        async () => {
                          if (source.reference_url)
                            await Linking.openURL(source.reference_url);
                        },
                        () => undefined,
                      )
                    }
                  />
                )}
              </View>
            );
          })
        ) : (
          <Type tone="muted">No sources cited.</Type>
        )}
        {request.error && !confirm && (
          <Type tone="danger" accessibilityRole="alert">
            Couldn’t open the source.
          </Type>
        )}
      </Card>
      <Dialog
        open={confirm}
        title="Remove this event?"
        onClose={() => setConfirm(false)}
      >
        <Type>
          This removes the event and its links. The people, archive files, and
          source records stay in the tree.
        </Type>
        {request.error && (
          <Type tone="danger" accessibilityRole="alert">
            Couldn’t remove the event. Reload if someone else edited it.
          </Type>
        )}
        <Button
          label={request.saving ? 'Removing…' : 'Confirm removal'}
          disabled={request.saving}
          onPress={() =>
            void request.save(
              () => repository.remove(treeId, event.id, version),
              () =>
                router.dismissTo({ pathname: '/timeline', params: { treeId } }),
            )
          }
        />
      </Dialog>
    </>
  );
}
