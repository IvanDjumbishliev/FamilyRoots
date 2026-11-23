import { useLocalSearchParams } from 'expo-router';

import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { useFamily } from '@/features/family/useFamily';
import {
  ConnectedTimeline,
  TimelineEntries,
} from '@/features/timeline/TimelineView';
import type { TimelineEvent } from '@/features/timeline/timelineModel';
import { useTimeline } from '@/features/timeline/useTimeline';
import { isRecordId } from '@/services/peopleRepository';

export default function TimelineRoute() {
  const { repository, treeId } = useTimeline();
  const params = useLocalSearchParams<{ treeId?: string }>();
  const tree = isRecordId(params.treeId) ? params.treeId : treeId;
  if (repository && tree)
    return (
      <ConnectedTimeline
        key={tree}
        repository={repository}
        initialTree={tree}
      />
    );
  return <DemoTimeline />;
}

function DemoTimeline() {
  const { snapshot } = useFamily();
  const events: TimelineEvent[] = [
    ...snapshot.history.map(
      (event): TimelineEvent => ({
        id: event.id,
        title: event.label,
        date: `${event.year}-01-01`,
        precision: 'year',
        type: 'custom',
        kind: 'family',
        approximate: false,
        verification: 'unverified',
        people: [],
        items: [],
        sources: [],
      }),
    ),
    ...snapshot.people.flatMap((person): TimelineEvent[] =>
      person.birthYear
        ? [
            {
              id: person.id,
              title: `${person.name} was born`,
              date: `${person.birthYear}-01-01`,
              precision: 'year',
              type: 'birth',
              kind: 'family',
              approximate: false,
              verification: 'unverified',
              people: [person.id],
              items: [],
              sources: [],
            },
          ]
        : [],
    ),
  ];
  return (
    <Screen>
      <PageHeading
        title="Family History Timeline"
        description="Connect Supabase and sign in to create or edit a shared timeline."
      />
      <TimelineEntries events={events} unit="decade" />
    </Screen>
  );
}
