import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { ActionLink } from '@/components/ActionLink';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { State } from '@/components/State';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { Choices } from '@/features/people/Choices';
import { livingOptions } from '@/features/people/personForm';
import { ConnectedTree } from '@/features/tree/ConnectedTree';
import { usePeopleQuery } from '@/features/people/usePeople';
import type { PeopleRepository } from '@/services/peopleRepository';

const recordOptions = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
] as const;
const livingFilter = [
  { value: 'all', label: 'All statuses' },
  ...livingOptions,
] as const;

export function PeopleDirectory({
  repository,
  initialTree,
}: {
  repository: PeopleRepository;
  initialTree: string;
}) {
  const [tree, setTree] = useState(initialTree);
  const trees = usePeopleQuery(repository.trees);
  const [section, setSection] = useState<'tree' | 'directory'>('tree');
  const read = useCallback(
    async () =>
      section === 'directory'
        ? repository.directory(tree)
        : { ...(await repository.access(tree)), people: [] },
    [repository, section, tree],
  );
  const result = usePeopleQuery(read);
  const [search, setSearch] = useState('');
  const [record, setRecord] =
    useState<(typeof recordOptions)[number]['value']>('active');
  const [status, setStatus] =
    useState<(typeof livingFilter)[number]['value']>('all');
  const term = search.trim().toLocaleLowerCase();
  const people = result.data?.people.filter(
    (person) =>
      (person.archived_at
        ? 'archived'
        : person.is_draft
          ? 'draft'
          : 'active') === record &&
      (status === 'all' || person.living_status === status) &&
      (!term ||
        [
          person.display_name,
          person.birth_name,
          ...person.alternative_names,
        ].some((name) => name?.toLocaleLowerCase().includes(term))),
  );

  return (
    <Screen>
      <PageHeading
        title="Family Tree"
        description={result.data?.name ?? 'Find and manage family members.'}
      />
      {trees.error && (
        <ErrorState message={trees.error} onRetry={trees.reload} />
      )}
      {(trees.data?.length ?? 0) > 1 && (
        <Choices
          label="Family tree"
          value={tree}
          onChange={setTree}
          choices={
            trees.data?.map((item) => ({ value: item.id, label: item.name })) ??
            []
          }
        />
      )}
      {result.data?.canEdit && (
        <ActionLink
          href={{ pathname: '/family-tree/add', params: { treeId: tree } }}
          icon="add"
          label="Add Person"
        />
      )}
      <ActionLink
        href={{ pathname: '/timeline', params: { treeId: tree } }}
        label="Family history timeline"
        variant="secondary"
      />
      <Choices
        label="Family tree workspace"
        value={section}
        onChange={setSection}
        choices={[
          { value: 'tree', label: 'Interactive tree' },
          { value: 'directory', label: 'People directory' },
        ]}
      />
      {section === 'tree' ? (
        <ConnectedTree
          key={tree}
          treeId={tree}
          canEdit={result.data?.canEdit ?? false}
        />
      ) : (
        <>
          <Card>
            <TextField
              label="Search people"
              value={search}
              onChangeText={setSearch}
              placeholder="Name, birth name, or alternative name"
            />
            <Choices
              label="Record status"
              choices={recordOptions}
              value={record}
              onChange={setRecord}
            />
            <Choices
              label="Living status"
              choices={livingFilter}
              value={status}
              onChange={setStatus}
            />
          </Card>
          {result.error ? (
            <ErrorState message={result.error} onRetry={result.reload} />
          ) : !people ? (
            <LoadingState label="Loading family members…" />
          ) : people.length ? (
            <Card>
              {people.map((person) => (
                <View key={person.id} style={{ gap: 3 }}>
                  <ActionLink
                    href={{
                      pathname: '/family-tree/[personId]',
                      params: { personId: person.id },
                    }}
                    label={person.display_name}
                    variant="quiet"
                    icon="person"
                  />
                  <Type variant="detail" tone="muted">
                    {
                      livingOptions.find(
                        (option) => option.value === person.living_status,
                      )?.label
                    }{' '}
                    · {verificationOptionsLabel(person.verification_status)}
                  </Type>
                </View>
              ))}
            </Card>
          ) : (
            <Card>
              <State
                kind="empty"
                title="No matching people"
                message={
                  record === 'active' && !term && status === 'all'
                    ? 'Active profiles will appear here. You can also check Drafts or Archived.'
                    : 'Try a different name or change the filters.'
                }
              />
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

function verificationOptionsLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
