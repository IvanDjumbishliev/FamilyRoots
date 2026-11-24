import { useMemo, useState } from 'react';

import { ActionLink } from '@/components/ActionLink';
import { Card } from '@/components/Card';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { State } from '@/components/State';
import { Type } from '@/components/Type';
import { ErrorState } from '@/components/ErrorState';
import { TextField } from '@/components/TextField';
import { searchPeople } from '@/features/family/familySummary';
import { PersonList } from '@/features/family/PersonList';
import { useFamily } from '@/features/family/useFamily';
import { useAuth } from '@/features/auth/AuthProvider';
import { ResearchWorkspace } from '@/features/discovery/ResearchWorkspace';
import { Choices } from '@/features/people/Choices';
import { usePeople, usePeopleQuery } from '@/features/people/usePeople';
import { createResearchRepository } from '@/services/researchRepository';

export default function DiscoverScreen() {
  const auth = useAuth();
  const client = auth.kind === 'ready' ? auth.client : undefined;
  const { repository: people, firstTree } = usePeople();
  const research = useMemo(
    () => client && createResearchRepository(client),
    [client],
  );
  return (
    <Screen>
      <PageHeading
        title="Discover"
        description="Explore historical records and compare potential matches with your family tree."
      />
      {research && people && firstTree ? (
        <ConnectedResearch
          key={firstTree}
          firstTree={firstTree}
          research={research}
          people={people}
        />
      ) : (
        <>
          <Type tone="muted">
            Connect a family tree to try historical research with fictional
            records. Live historical data is unavailable.
          </Type>
          <TreeSearch />
        </>
      )}
    </Screen>
  );
}

function ConnectedResearch({
  people,
  research,
  firstTree,
}: {
  people: NonNullable<ReturnType<typeof usePeople>['repository']>;
  research: ReturnType<typeof createResearchRepository>;
  firstTree: string;
}) {
  const trees = usePeopleQuery(people.trees);
  const [tree, setTree] = useState(firstTree);
  return (
    <>
      {trees.error && (
        <ErrorState message={trees.error} onRetry={trees.reload} />
      )}
      {(trees.data?.length ?? 0) > 1 && (
        <Choices
          label="Family tree"
          value={tree}
          onChange={setTree}
          choices={(trees.data ?? []).map(({ id, name }) => ({
            value: id,
            label: name,
          }))}
        />
      )}
      <ResearchWorkspace
        key={tree}
        tree={tree}
        repository={research}
        people={people}
      />
    </>
  );
}

function TreeSearch() {
  const { snapshot } = useFamily();
  const [query, setQuery] = useState('');
  const results = searchPeople(snapshot.people, query);

  return (
    <Card>
      {snapshot.people.length ? (
        <>
          <TextField
            label="Search your family tree"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {results.length ? (
            <PersonList people={results} />
          ) : query.trim() ? (
            <State
              kind="empty"
              title="No matches"
              message="Try part of a name or a different relationship."
            />
          ) : null}
        </>
      ) : (
        <>
          <State
            kind="empty"
            title="Your tree has no people to search"
            message="Add a relative to make them searchable here."
          />
          <ActionLink href="/family-tree/add" label="Add Person" icon="add" />
        </>
      )}
    </Card>
  );
}
