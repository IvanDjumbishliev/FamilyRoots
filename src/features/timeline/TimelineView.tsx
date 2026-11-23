import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { State } from '@/components/State';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { ArchivePicker } from '@/features/archive/ArchivePicker';
import { Choices } from '@/features/people/Choices';
import { usePeopleQuery } from '@/features/people/usePeople';
import { indexTree, visiblePeople } from '@/features/tree/treeLayout';
import { useTheme } from '@/hooks/useTheme';
import type { TimelineRepository } from '@/services/timelineRepository';

import {
  eventDateLabel,
  eventTypes,
  filterTimeline,
  parseYearFilter,
  timelineForBook,
  type EventType,
  type TimelineEvent,
} from './timelineModel';

const grouping = [
  { value: 'decade', label: 'Decades' },
  { value: 'century', label: 'Centuries' },
] as const;
const typeChoices = [
  { value: 'all', label: 'All events' },
  ...eventTypes,
] as const;

export function ConnectedTimeline({
  repository,
  initialTree,
}: {
  repository: TimelineRepository;
  initialTree: string;
}) {
  const trees = usePeopleQuery(repository.trees);
  const [tree, setTree] = useState(initialTree);
  const read = useCallback(() => repository.read(tree), [repository, tree]);
  const result = usePeopleQuery(read);

  return (
    <Screen>
      <PageHeading
        title="Family History Timeline"
        description={result.data?.name}
      />
      {trees.error && (
        <ErrorState message={trees.error} onRetry={trees.reload} />
      )}
      {(trees.data?.length ?? 0) > 1 && (
        <Choices
          label="Family tree"
          choices={
            trees.data?.map(({ id, name }) => ({ value: id, label: name })) ??
            []
          }
          value={tree}
          onChange={setTree}
        />
      )}
      {result.error ? (
        <ErrorState message={result.error} onRetry={result.reload} />
      ) : !result.data ? (
        <LoadingState label="Loading timeline…" />
      ) : (
        <TimelineContent key={tree} treeId={tree} data={result.data} />
      )}
    </Screen>
  );
}

type ReadResult = Awaited<ReturnType<TimelineRepository['read']>>;

function TimelineContent({
  treeId,
  data,
}: {
  treeId: string;
  data: ReadResult;
}) {
  const [type, setType] = useState<'all' | EventType>('all');
  const [unit, setUnit] = useState<'decade' | 'century'>('decade');
  const [person, setPerson] = useState('');
  const [branch, setBranch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showUndated, setShowUndated] = useState<boolean>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(40);
  const years = parseYearFilter(from, to);
  const includeUndated = showUndated ?? (!from.trim() && !to.trim());
  const people = useMemo(
    () =>
      data.people.map((record) => ({
        id: record.id,
        label: record.display_name,
      })),
    [data.people],
  );
  const branchMembers = useMemo(() => {
    if (!branch) return;
    const tree = indexTree(
      data.people.map((record) => ({
        id: record.id,
        name: record.display_name,
        aliases: record.alternative_names,
      })),
      data.connections,
    );
    return visiblePeople(tree, 'descendants', branch, new Set());
  }, [branch, data.connections, data.people]);
  const shown = filterTimeline(data.events, {
    type: type === 'all' ? undefined : type,
    person: person || undefined,
    branch: branchMembers,
    from: years.from,
    to: years.to,
    includeUndated,
  });

  return (
    <>
      {data.canEdit && (
        <ActionLink
          href={{ pathname: '/timeline/add', params: { treeId } }}
          label="Add event"
          icon="add"
        />
      )}
      <Card>
        <Choices
          label="Group by"
          choices={grouping}
          value={unit}
          onChange={setUnit}
        />
        <Button
          label={filtersOpen ? 'Hide filters' : 'Show filters'}
          variant="secondary"
          aria-expanded={filtersOpen}
          onPress={() => setFiltersOpen(!filtersOpen)}
        />
        {filtersOpen && (
          <>
            <Choices
              label="Event type"
              choices={typeChoices}
              value={type}
              onChange={setType}
            />
            <ArchivePicker
              label="Filter by person"
              options={people}
              selected={person ? [person] : []}
              onToggle={(id) => setPerson(person === id ? '' : id)}
            />
            <ArchivePicker
              label="Filter by family branch"
              options={people}
              selected={branch ? [branch] : []}
              onToggle={(id) => setBranch(branch === id ? '' : id)}
            />
            <Type variant="detail" tone="muted">
              A branch includes the selected person and descendants linked in
              the tree.
            </Type>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <View style={{ flexGrow: 1, flexBasis: 120 }}>
                <TextField
                  label="From year"
                  value={from}
                  onChangeText={setFrom}
                  inputMode="numeric"
                  maxLength={4}
                />
              </View>
              <View style={{ flexGrow: 1, flexBasis: 120 }}>
                <TextField
                  label="Through year"
                  value={to}
                  onChangeText={setTo}
                  inputMode="numeric"
                  maxLength={4}
                />
              </View>
            </View>
            <Button
              label="Include unknown dates"
              variant="secondary"
              accessibilityRole="checkbox"
              aria-checked={includeUndated}
              accessibilityState={{ checked: includeUndated }}
              selected={includeUndated}
              onPress={() => setShowUndated(!includeUndated)}
            />
          </>
        )}
      </Card>
      {years.error ? (
        <Type tone="danger" accessibilityRole="alert">
          {years.error}
        </Type>
      ) : shown.length ? (
        <>
          <TimelineEntries
            events={shown}
            unit={unit}
            linkEvents
            limit={limit}
          />
          {(shown.filter((event) => event.kind === 'family').length > limit ||
            shown.filter((event) => event.kind === 'context').length >
              limit) && (
            <Button
              label="Show more events"
              variant="secondary"
              onPress={() => setLimit((previous) => previous + 40)}
            />
          )}
        </>
      ) : (
        <Card>
          <State
            kind="empty"
            title={
              data.events.length
                ? 'No matching events'
                : 'No timeline events yet'
            }
            message={
              data.events.length
                ? 'Try changing the person, branch, event type, or years.'
                : 'Add a family milestone or a note about the historical context.'
            }
          />
        </Card>
      )}
    </>
  );
}

export function TimelineEntries({
  events,
  unit,
  linkEvents,
  limit = 40,
}: {
  events: readonly TimelineEvent[];
  unit: 'decade' | 'century';
  linkEvents?: boolean;
  limit?: number;
}) {
  const { theme } = useTheme();
  const { family, historicalContext } = timelineForBook(events, unit);
  return (
    <>
      {[
        { title: 'Family events', groups: family },
        { title: 'Historical context', groups: historicalContext },
      ]
        .filter(({ groups }) => groups.length)
        .map(({ title, groups }) => {
          let remaining = limit;
          return (
            <View key={title} style={{ gap: 12 }}>
              <Type variant="heading" accessibilityRole="header">
                {title}
              </Type>
              {groups.flatMap(({ period, entries }) => {
                if (!remaining) return [];
                const subset = entries.slice(0, remaining);
                remaining -= subset.length;
                return [
                  <Card key={period}>
                    <Type variant="heading" accessibilityRole="header">
                      {period}
                    </Type>
                    {subset.map((event) => (
                      <View
                        key={event.id}
                        style={{
                          borderLeftWidth: 2,
                          borderColor: theme.colors.border,
                          paddingLeft: 12,
                          gap: 3,
                        }}
                      >
                        <Type variant="detail" tone="accent">
                          {eventDateLabel(event)}
                        </Type>
                        {linkEvents ? (
                          <ActionLink
                            href={{
                              pathname: '/timeline/[eventId]',
                              params: { eventId: event.id },
                            }}
                            label={event.title}
                            variant="quiet"
                          />
                        ) : (
                          <Type variant="label">{event.title}</Type>
                        )}
                        <Type variant="detail" tone="muted">
                          {
                            eventTypes.find(
                              (option) => option.value === event.type,
                            )?.label
                          }
                          {event.kind === 'family'
                            ? ` · ${event.verification}`
                            : ' · Context note'}
                        </Type>
                      </View>
                    ))}
                  </Card>,
                ];
              })}
            </View>
          );
        })}
    </>
  );
}
