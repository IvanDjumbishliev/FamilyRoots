import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { Type } from '@/components/Type';
import { useAuth } from '@/features/auth/AuthProvider';
import { ReviewProposal } from '@/features/collaboration/ReviewProposal';
import { useSave } from '@/features/family/useSave';
import { formatHistoricalDate } from '@/features/people/personForm';
import { usePeopleQuery } from '@/features/people/usePeople';
import { ConnectionEditor } from '@/features/relationships/ConnectionEditor';
import {
  buildFamilyGraph,
  connectionLabel,
  endpoints,
  type Connection,
} from '@/features/relationships/relationshipGraph';
import { RelativePicker } from '@/features/relationships/RelativePicker';
import {
  createRelationshipRepository,
  type RelationshipData,
  type RelationshipRepository,
} from '@/services/relationshipRepository';

export function PersonRelationships({
  personId,
  treeId,
  canEdit,
  addRelative,
  clearAddRelative,
}: {
  personId: string;
  treeId: string;
  canEdit: boolean;
  addRelative?: boolean;
  clearAddRelative?: () => void;
}) {
  const auth = useAuth();
  const client = auth.kind === 'ready' ? auth.client : undefined;
  const repository = useMemo(
    () => (client ? createRelationshipRepository(client) : undefined),
    [client],
  );
  return repository ? (
    <Connections
      personId={personId}
      treeId={treeId}
      canEdit={canEdit}
      repository={repository}
      addRelative={addRelative}
      clearAddRelative={clearAddRelative}
    />
  ) : null;
}

function Connections({
  personId,
  treeId,
  canEdit,
  repository,
  addRelative,
  clearAddRelative,
}: {
  personId: string;
  treeId: string;
  canEdit: boolean;
  repository: RelationshipRepository;
  addRelative?: boolean;
  clearAddRelative?: () => void;
}) {
  const read = useCallback(() => repository.read(treeId), [repository, treeId]);
  const query = usePeopleQuery(read);
  if (!query.data)
    return (
      <Card>
        <Type variant="heading" accessibilityRole="header">
          Relationships
        </Type>
        {query.error ? (
          <ErrorState message={query.error} onRetry={query.reload} />
        ) : (
          <LoadingState label="Loading relationships…" />
        )}
      </Card>
    );
  return (
    <RelationshipCards
      personId={personId}
      treeId={treeId}
      canEdit={canEdit}
      repository={repository}
      data={query.data}
      addRelative={addRelative}
      clearAddRelative={clearAddRelative}
      reload={query.reload}
    />
  );
}

function RelationshipCards({
  personId,
  treeId,
  canEdit,
  repository,
  data,
  reload,
  addRelative,
  clearAddRelative,
}: {
  personId: string;
  treeId: string;
  canEdit: boolean;
  repository: RelationshipRepository;
  data: RelationshipData;
  reload: () => void;
  addRelative?: boolean;
  clearAddRelative?: () => void;
}) {
  const [editor, setEditor] = useState<'new' | Connection>();
  useEffect(() => {
    if (addRelative && canEdit) {
      setEditor('new');
      clearAddRelative?.();
    }
  }, [addRelative, canEdit, clearAddRelative]);
  const [remove, setRemove] = useState<Connection>();
  const [pathOpen, setPathOpen] = useState(false);
  const [destination, setDestination] = useState<string>();
  const [showAncestry, setShowAncestry] = useState(false);
  const request = useSave();
  const people = useMemo(
    () => new Map(data.people.map((person) => [person.id, person])),
    [data.people],
  );
  const graph = useMemo(
    () => buildFamilyGraph([...people.keys()], data.connections),
    [people, data.connections],
  );
  const direct = data.connections.filter((connection) =>
    endpoints(connection).includes(personId),
  );
  const ancestry = graph.ancestry(personId);
  const path = destination
    ? graph.relationshipPath(personId, destination)
    : undefined;
  const generation = graph.generations.get(personId);

  function personName(id: string) {
    const person = people.get(id);
    return person
      ? person.display_name + (person.archived_at ? ' (archived)' : '')
      : 'Unknown person';
  }

  function personLink(id: string) {
    return (
      <ActionLink
        key={id}
        href={{ pathname: '/family-tree/[personId]', params: { personId: id } }}
        variant="quiet"
        label={personName(id)}
      />
    );
  }

  return (
    <>
      <Card>
        <Type variant="heading" accessibilityRole="header">
          Relationships
        </Type>
        {canEdit && (
          <Button
            label="Add relationship"
            icon="add"
            onPress={() => setEditor('new')}
          />
        )}
        {direct.length === 0 && (
          <Type tone="muted">
            No connections recorded. Unknown relatives can be left unlinked.
          </Type>
        )}
        {direct.map((connection) => {
          const relative = endpoints(connection).find((id) => id !== personId);
          const start =
            connection.category === 'partnership'
              ? formatHistoricalDate(
                  connection.startedOn,
                  connection.startPrecision,
                )
              : '';
          const end =
            connection.category === 'partnership'
              ? formatHistoricalDate(
                  connection.endedOn,
                  connection.endPrecision,
                )
              : '';
          return (
            <View
              key={`${connection.category}-${connection.id}`}
              style={{ gap: 6 }}
            >
              <Type variant="label">
                {connectionLabel(connection, personId)}
              </Type>
              {relative && personLink(relative)}
              <Type variant="detail" tone="muted">
                {connection.provenance.replaceAll('_', ' ')} ·{' '}
                {connection.verification}
                {connection.category === 'partnership'
                  ? ` · ${connection.status === 'unknown' ? 'status unknown' : connection.status}`
                  : ''}
              </Type>
              {connection.category === 'partnership' && (start || end) && (
                <Type variant="detail" tone="muted">
                  {start
                    ? `Started ${connection.startApproximate ? 'about ' : ''}${start}`
                    : 'Start unknown'}
                  {' · '}
                  {end
                    ? `Ended ${connection.endApproximate ? 'about ' : ''}${end}`
                    : 'End unknown'}
                </Type>
              )}
              {connection.notes && <Type>{connection.notes}</Type>}
              {canEdit && connection.verification !== 'disputed' && (
                <ReviewProposal
                  treeId={treeId}
                  target={
                    connection.category === 'parent'
                      ? 'parent_child_relationships'
                      : connection.category === 'partnership'
                        ? 'partnerships'
                        : 'other_family_relationships'
                  }
                  id={connection.id}
                  onSubmitted={reload}
                />
              )}
              {canEdit && (
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                >
                  <Button
                    label="Edit relationship"
                    variant="secondary"
                    onPress={() => setEditor(connection)}
                  />
                  <Button
                    label="Remove connection"
                    variant="quiet"
                    onPress={() => setRemove(connection)}
                  />
                </View>
              )}
            </View>
          );
        })}
      </Card>
      <Card>
        <Type variant="heading" accessibilityRole="header">
          Family connections and ancestry
        </Type>
        <Type tone="muted">
          Siblings, grandparents, and generations use recorded biological and
          adoptive parent links. Disputed and AI-suggested links are excluded.
        </Type>
        <Type>
          {generation
            ? `Generation ${generation} in the recorded ancestry`
            : 'Generation is unresolved. Check the recorded parent links.'}
        </Type>
        {[
          { label: 'Siblings', ids: graph.siblings(personId) },
          { label: 'Grandparents', ids: graph.grandparents(personId) },
          { label: 'Grandchildren', ids: graph.grandchildren(personId) },
        ].map(({ label, ids }) => (
          <View key={label} style={{ gap: 4 }}>
            <Type variant="label">{label}</Type>
            {ids.length ? (
              ids.map(personLink)
            ) : (
              <Type variant="detail" tone="muted">
                None derived from recorded links.
              </Type>
            )}
          </View>
        ))}
        {ancestry.length > 0 && (
          <Button
            label={showAncestry ? 'Hide ancestry paths' : 'Show ancestry paths'}
            variant="secondary"
            onPress={() => setShowAncestry(!showAncestry)}
          />
        )}
        {showAncestry &&
          ancestry.map((ancestor) => (
            <Type key={ancestor.id} variant="detail">
              {personName(ancestor.id)} · {ancestor.depth}{' '}
              {ancestor.depth === 1 ? 'generation' : 'generations'} back
              {ancestor.via !== personId && ` via ${personName(ancestor.via)}`}
            </Type>
          ))}
        <Button
          label="Find relationship path"
          variant="secondary"
          onPress={() => setPathOpen(true)}
        />
      </Card>
      <Dialog
        open={Boolean(editor)}
        title={editor === 'new' ? 'Add relationship' : 'Edit relationship'}
        onClose={() => setEditor(undefined)}
      >
        {editor && (
          <ConnectionEditor
            key={editor === 'new' ? 'new' : editor.id}
            personId={personId}
            people={data.people}
            connection={editor === 'new' ? undefined : editor}
            save={(values) =>
              repository.save(
                treeId,
                personId,
                values,
                editor === 'new' ? undefined : editor.updatedAt,
              )
            }
            onSaved={() => {
              setEditor(undefined);
              reload();
            }}
          />
        )}
      </Dialog>
      <Dialog
        open={Boolean(remove)}
        title="Remove this connection?"
        onClose={() => setRemove(undefined)}
      >
        <Type>
          This removes the relationship and any citations to that connection.
          Both people remain in the tree.
        </Type>
        {request.error && (
          <Type tone="danger" accessibilityRole="alert">
            Couldn’t remove the connection. Check your access and try again.
          </Type>
        )}
        <Button
          label={request.saving ? 'Removing…' : 'Confirm removal'}
          disabled={request.saving}
          onPress={() => {
            if (remove)
              void request.save(
                () => repository.remove(treeId, remove),
                () => {
                  setRemove(undefined);
                  reload();
                },
              );
          }}
        />
      </Dialog>
      <Dialog
        open={pathOpen}
        title="Find relationship path"
        onClose={() => setPathOpen(false)}
      >
        {pathOpen && (
          <>
            <RelativePicker
              people={data.people.filter((person) => person.id !== personId)}
              selected={destination}
              onSelect={setDestination}
              label="Search destination person"
            />
            {destination &&
              (path?.length ? (
                path.map((step, index) => (
                  <Type key={`${step.from}-${step.to}`}>
                    {index + 1}. {personName(step.from)} →{' '}
                    {connectionLabel(step.connection, step.from)} →{' '}
                    {personName(step.to)}
                  </Type>
                ))
              ) : (
                <Type tone="muted">
                  No recorded path connects these people.
                </Type>
              ))}
          </>
        )}
      </Dialog>
    </>
  );
}
