import { useCallback, useMemo, useState } from 'react';
import { Image, View } from 'react-native';

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
import { Choices } from '@/features/people/Choices';
import { formatHistoricalDate } from '@/features/people/personForm';
import { usePeopleQuery } from '@/features/people/usePeople';
import type { ArchiveRepository } from '@/services/archiveRepository';

import { ArchivePicker } from './ArchivePicker';

const kinds = [
  { value: 'all', label: 'All files' },
  { value: 'image', label: 'Photos' },
  { value: 'document', label: 'Documents' },
] as const;

export function ArchiveDirectory({
  repository,
  initialTree,
}: {
  repository: ArchiveRepository;
  initialTree: string;
}) {
  const trees = usePeopleQuery(repository.trees);
  const [tree, setTree] = useState(initialTree);
  const read = useCallback(async () => {
    const [context, items] = await Promise.all([
      repository.context(tree),
      repository.items(tree),
    ]);
    return { context, items };
  }, [repository, tree]);
  const data = usePeopleQuery(read);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<(typeof kinds)[number]['value']>('all');
  const [collection, setCollection] = useState('');
  const [person, setPerson] = useState('');
  const [event, setEvent] = useState('');
  const [limit, setLimit] = useState(18);
  const query = search.trim().toLocaleLowerCase();
  const context = data.data?.context;
  const matching = useMemo(() => {
    const people = new Map(
      context?.people.map(({ id, display_name }) => [id, display_name]),
    );
    const events = new Map(context?.events.map(({ id, title }) => [id, title]));
    return (
      data.data?.items.filter(
        (item) =>
          (kind === 'all' ||
            item.mime_type.startsWith('image/') === (kind === 'image')) &&
          (!collection || item.collection === collection) &&
          (!person ||
            item.archive_item_people.some(
              (link) => link.person_id === person,
            )) &&
          (!event || item.event_id === event) &&
          (!query ||
            [
              item.title,
              item.file_name,
              item.description,
              item.location,
              item.collection,
              item.source_note,
              item.event_id && events.get(item.event_id),
              ...item.archive_item_people.map((link) =>
                people.get(link.person_id),
              ),
            ].some(
              (value) =>
                typeof value === 'string' &&
                value.toLocaleLowerCase().includes(query),
            )),
      ) ?? []
    );
  }, [collection, context, data.data, event, kind, person, query]);

  const paths = useMemo(
    () =>
      matching
        .slice(0, limit)
        .flatMap((item) => (item.thumbnail_path ? [item.thumbnail_path] : [])),
    [matching, limit],
  );
  const loadThumbs = useCallback(
    () => repository.thumbnails(paths),
    [repository, paths],
  );
  const thumbs = usePeopleQuery(loadThumbs);
  const collections = [
    ...new Set(
      data.data?.items.flatMap((item) =>
        item.collection ? [item.collection] : [],
      ),
    ),
  ].sort();

  return (
    <Screen>
      <PageHeading
        title="Family Archive"
        description="Photographs, letters, and documents shared only with authorized tree members."
      />
      {trees.error && (
        <ErrorState message={trees.error} onRetry={trees.reload} />
      )}
      {(trees.data?.length ?? 0) > 1 && (
        <Choices
          label="Family tree"
          value={tree}
          choices={
            trees.data?.map(({ id, name }) => ({ value: id, label: name })) ??
            []
          }
          onChange={(id) => {
            setTree(id);
            setPerson('');
            setEvent('');
            setCollection('');
            setLimit(18);
          }}
        />
      )}
      {context?.canEdit && (
        <ActionLink
          href={{
            pathname: '/family-archive/upload',
            params: { treeId: tree },
          }}
          label="Upload Memory"
          icon="upload"
        />
      )}
      <Card>
        <TextField
          label="Search archive"
          value={search}
          onChangeText={(value) => {
            setSearch(value);
            setLimit(18);
          }}
        />
        <Choices
          label="File type"
          choices={kinds}
          value={kind}
          onChange={(value) => {
            setKind(value);
            setLimit(18);
          }}
        />
        {collections.length > 0 && (
          <ArchivePicker
            label="Filter by collection"
            options={collections.map((value) => ({ id: value, label: value }))}
            selected={collection ? [collection] : []}
            onToggle={(id) => {
              setCollection(collection === id ? '' : id);
              setLimit(18);
            }}
          />
        )}
        {context && (
          <ArchivePicker
            label="Filter by person"
            options={context.people.map(({ id, display_name }) => ({
              id,
              label: display_name,
            }))}
            selected={person ? [person] : []}
            onToggle={(id) => {
              setPerson(person === id ? '' : id);
              setLimit(18);
            }}
          />
        )}
        {context && context.events.length > 0 && (
          <ArchivePicker
            label="Filter by event"
            options={context.events.map(({ id, title }) => ({
              id,
              label: title,
            }))}
            selected={event ? [event] : []}
            onToggle={(id) => {
              setEvent(event === id ? '' : id);
              setLimit(18);
            }}
          />
        )}
      </Card>
      {data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : !data.data ? (
        <LoadingState label="Loading archive…" />
      ) : !matching.length ? (
        <Card>
          <State
            kind="empty"
            title={
              data.data.items.length
                ? 'No matching archive items'
                : 'Your archive is empty'
            }
            message={
              data.data.items.length
                ? 'Try a different search or remove a filter.'
                : 'Add a photograph, document, or letter to preserve it with the tree.'
            }
          />
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {matching.slice(0, limit).map((item) => {
            const uri = item.thumbnail_path
              ? thumbs.data?.get(item.thumbnail_path)
              : undefined;
            return (
              <Card key={item.id}>
                {uri && (
                  <Image
                    source={{ uri }}
                    accessibilityLabel={`Thumbnail for ${item.title}`}
                    style={{ width: 120, height: 90 }}
                    resizeMode="cover"
                  />
                )}
                <ActionLink
                  href={{
                    pathname: '/family-archive/[itemId]',
                    params: { itemId: item.id },
                  }}
                  label={item.title}
                  variant="quiet"
                />
                <Type variant="detail" tone="muted">
                  {[
                    item.file_name,
                    item.collection,
                    formatHistoricalDate(item.recorded_on, item.date_precision),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Type>
              </Card>
            );
          })}
          {limit < matching.length && (
            <Button
              label="Show more items"
              variant="secondary"
              onPress={() => setLimit((previous) => previous + 18)}
            />
          )}
        </View>
      )}
    </Screen>
  );
}
