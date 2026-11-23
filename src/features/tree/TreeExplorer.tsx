import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { State } from '@/components/State';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { Choices } from '@/features/people/Choices';
import {
  connectionLabel,
  endpoints,
  type Connection,
} from '@/features/relationships/relationshipGraph';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/hooks/useTheme';

import { TreeCanvas } from './TreeCanvas';
import {
  centerOn,
  indexTree,
  layoutTree,
  visiblePeople,
  zoomAt,
  type PositionedPerson,
  type TreePerson,
  type TreeScope,
  type TreeTransform,
} from './treeLayout';

const scopes = [
  { value: 'full', label: 'Full tree' },
  { value: 'ancestors', label: 'Ancestors' },
  { value: 'descendants', label: 'Descendants' },
] as const;
const representations = [
  { value: 'diagram', label: 'Diagram' },
  { value: 'list', label: 'Accessible list' },
] as const;

function midpoint(person: PositionedPerson) {
  return { x: person.x + person.width / 2, y: person.y + person.height / 2 };
}

export function TreeExplorer({
  people,
  connections,
  canEdit,
  isDemo = false,
}: {
  people: readonly TreePerson[];
  connections: readonly Connection[];
  canEdit: boolean;
  isDemo?: boolean;
}) {
  const { theme } = useTheme();
  const { tablet } = useLayout();
  const [representation, setRepresentation] = useState<'diagram' | 'list'>(
    'diagram',
  );
  const [scope, setScope] = useState<TreeScope>('full');
  const [selected, setSelected] = useState<string>();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(24);
  const [width, setWidth] = useState(0);
  const [transform, setTransform] = useState<TreeTransform>({
    x: 0,
    y: 0,
    scale: 0.85,
  });
  const height = tablet ? 560 : 410;
  const tree = useMemo(
    () => indexTree(people, connections),
    [people, connections],
  );
  const focus = selected && tree.byId.has(selected) ? selected : people[0]?.id;
  const included = useMemo(
    () =>
      visiblePeople(
        tree,
        scope,
        scope === 'full' ? undefined : focus,
        collapsed,
      ),
    [tree, scope, focus, collapsed],
  );
  const layout = useMemo(() => layoutTree(tree, included), [tree, included]);
  const active = focus ? tree.byId.get(focus) : undefined;
  const position = focus ? layout.positions.get(focus) : undefined;
  const outgoing = scope === 'ancestors' ? tree.parents : tree.children;
  const canFold = Boolean(focus && outgoing.get(focus)?.size);
  const query = search.trim().toLocaleLowerCase();
  const results = useMemo(
    () =>
      query
        ? people
            .filter((person) =>
              [person.name, ...person.aliases].some((value) =>
                value.toLocaleLowerCase().includes(query),
              ),
            )
            .slice(0, 12)
        : [],
    [people, query],
  );
  const shown = `${included.size} ${included.size === 1 ? 'person' : 'people'} shown`;
  const visibleRows = useMemo(() => layout.rows.flat(), [layout.rows]);
  const summaries = useMemo(() => {
    const items = new Map<string, string[]>();
    if (representation !== 'list') return items;
    for (const edge of layout.lines) {
      const [a, b] = endpoints(edge.connection);
      for (const [from, to] of [
        [a, b],
        [b, a],
      ]) {
        const list = items.get(from) ?? [];
        list.push(
          `${connectionLabel(edge.connection, from)}: ${tree.byId.get(to)?.name ?? 'Unknown person'}${edge.uncertain ? ' (uncertain)' : ''}`,
        );
        items.set(from, list);
      }
    }
    return items;
  }, [layout.lines, representation, tree.byId]);

  useEffect(() => {
    if (representation !== 'diagram' || !width || !position) return;
    setTransform((current) =>
      centerOn(current, { width, height }, midpoint(position)),
    );
  }, [height, position, representation, width]);

  function center() {
    if (position)
      setTransform((current) =>
        centerOn(current, { width, height }, midpoint(position)),
      );
  }

  function fit() {
    const scale = Math.min(
      1,
      Math.max(
        0.06,
        Math.min((width - 24) / layout.width, (height - 24) / layout.height),
      ),
    );
    setTransform(
      centerOn(
        { scale, x: 0, y: 0 },
        { width, height },
        { x: layout.width / 2, y: layout.height / 2 },
      ),
    );
  }

  function focusPerson(id: string) {
    setSelected(id);
    setLimit(24);
    if (representation === 'list') setRepresentation('diagram');
    if (!included.has(id)) {
      setScope('full');
      setCollapsed(new Set());
      setTransform((current) => ({
        ...current,
        scale: Math.max(current.scale, 0.75),
      }));
    } else {
      const target = layout.positions.get(id);
      if (target)
        setTransform((current) =>
          centerOn(
            { ...current, scale: Math.max(current.scale, 0.75) },
            { width, height },
            midpoint(target),
          ),
        );
    }
    setSearch('');
  }

  function fold() {
    if (!focus) return;
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(focus)) next.delete(focus);
      else next.add(focus);
      return next;
    });
  }

  if (!people.length)
    return (
      <Card>
        <State
          kind="empty"
          title="Your tree is empty"
          message={
            canEdit
              ? 'Add a person to begin, then connect relatives from their profile or the tree.'
              : 'People will appear when an owner or editor adds them.'
          }
        />
      </Card>
    );

  return (
    <>
      <Card>
        <TextField
          label="Find and focus a person"
          value={search}
          onChangeText={setSearch}
          placeholder="Search names or aliases"
        />
        {query && (
          <View style={{ gap: 6 }}>
            {results.map((person) => (
              <Button
                key={person.id}
                variant="quiet"
                label={`Focus ${person.name}`}
                onPress={() => focusPerson(person.id)}
              />
            ))}
            {!results.length && <Type tone="muted">No matching people.</Type>}
          </View>
        )}
        <Choices
          label="Tree view"
          choices={scopes}
          value={scope}
          onChange={(value) => {
            setScope(value);
            setCollapsed(new Set());
            setLimit(24);
          }}
        />
        <Choices
          label="Display"
          choices={representations}
          value={representation}
          onChange={(value) => {
            setRepresentation(value);
            setLimit(24);
          }}
        />
        <Type accessibilityLiveRegion="polite" variant="label">
          {active ? `Focused on ${active.name} · ${shown}` : shown}
        </Type>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {representation === 'diagram' && (
            <Button
              label="Center focused person"
              variant="secondary"
              onPress={center}
            />
          )}
          {canFold && (
            <Button
              label={
                focus && collapsed.has(focus)
                  ? 'Expand branch'
                  : 'Collapse branch'
              }
              variant="secondary"
              onPress={fold}
            />
          )}
          {canEdit && active && (
            <ActionLink
              label="Add relative"
              icon="add"
              href={
                isDemo
                  ? {
                      pathname: '/family-tree/add',
                      params: { relativeTo: active.id },
                    }
                  : {
                      pathname: '/family-tree/[personId]',
                      params: { personId: active.id, addRelative: '1' },
                    }
              }
            />
          )}
          {active && (
            <ActionLink
              label="Open focused profile"
              variant="quiet"
              href={{
                pathname: '/family-tree/[personId]',
                params: { personId: active.id },
              }}
            />
          )}
        </View>
      </Card>
      {representation === 'diagram' ? (
        <Card style={{ padding: 12 }}>
          <Type variant="detail" tone="muted">
            Drag to pan and pinch or scroll to zoom. On a keyboard, focus the
            diagram and use the arrow keys and + or −.
          </Type>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button
              label="Zoom in"
              variant="secondary"
              onPress={() =>
                setTransform((current) =>
                  zoomAt(current, 1.25, { x: width / 2, y: height / 2 }),
                )
              }
            />
            <Button
              label="Zoom out"
              variant="secondary"
              onPress={() =>
                setTransform((current) =>
                  zoomAt(current, 0.8, { x: width / 2, y: height / 2 }),
                )
              }
            />
            <Button label="Fit tree" variant="quiet" onPress={fit} />
            <Type variant="detail" tone="muted" style={{ alignSelf: 'center' }}>
              {Math.round(transform.scale * 100)}%
            </Type>
          </View>
          <View
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            style={{
              height,
              alignSelf: 'stretch',
              overflow: 'hidden',
              borderRadius: theme.borders.control,
              minWidth: 0,
            }}
          >
            {width > 0 && (
              <TreeCanvas
                layout={layout}
                viewport={{ width, height }}
                transform={transform}
                selected={focus}
                collapsed={collapsed}
                onSelect={setSelected}
                onChange={setTransform}
              />
            )}
          </View>
          <Type variant="detail" tone="muted">
            Gray lines show parent and child. Gold shows partners. Dashes show
            step or other connections, and dots flag disputed or AI-suggested
            links.
          </Type>
        </Card>
      ) : (
        <Card>
          <Type variant="heading" accessibilityRole="header">
            Family tree list
          </Type>
          {visibleRows.slice(0, limit).map(({ person, generation }, index) => (
            <View key={person.id} style={{ gap: 4 }}>
              {(index === 0 ||
                visibleRows[index - 1].generation !== generation) && (
                <Type variant="heading" accessibilityRole="header">
                  Generation {generation}
                </Type>
              )}
              <ActionLink
                label={person.name}
                variant="quiet"
                href={{
                  pathname: '/family-tree/[personId]',
                  params: { personId: person.id },
                }}
              />
              {(summaries.get(person.id) ?? []).map((summary, item) => (
                <Type key={`${item}-${summary}`} variant="detail" tone="muted">
                  {summary}
                </Type>
              ))}
            </View>
          ))}
          {limit < visibleRows.length && (
            <Button
              label="Show more people"
              variant="secondary"
              onPress={() => setLimit((previous) => previous + 24)}
            />
          )}
        </Card>
      )}
    </>
  );
}
