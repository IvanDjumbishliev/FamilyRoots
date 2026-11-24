import { useMemo, useState } from 'react';

import { ActionLink } from '@/components/ActionLink';
import { ErrorState } from '@/components/ErrorState';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { Type } from '@/components/Type';
import { AssistantWorkspace } from '@/features/assistant/AssistantWorkspace';
import { useAuth } from '@/features/auth/AuthProvider';
import { Choices } from '@/features/people/Choices';
import { usePeople, usePeopleQuery } from '@/features/people/usePeople';
import {
  createAssistantRepository,
  type AssistantRepository,
} from '@/services/assistantRepository';
import type { PeopleRepository } from '@/services/peopleRepository';

export default function AssistantRoute() {
  const auth = useAuth();
  const client =
    auth.kind === 'ready' && auth.session ? auth.client : undefined;
  const { repository: people, firstTree } = usePeople();
  const assistant = useMemo(
    () => client && createAssistantRepository(client),
    [client],
  );
  return (
    <Screen>
      <ActionLink href="/discover" label="Back to Discover" variant="quiet" />
      <PageHeading
        title="Genealogy assistant"
        description="Work through questions using records you can review."
      />
      {assistant && people && firstTree ? (
        <Connected
          key={firstTree}
          initial={firstTree}
          assistant={assistant}
          people={people}
        />
      ) : (
        <Type tone="muted">
          Sign in to a connected family tree to use the assistant. A live
          provider is optional.
        </Type>
      )}
    </Screen>
  );
}

function Connected({
  initial,
  assistant,
  people,
}: {
  initial: string;
  assistant: AssistantRepository;
  people: PeopleRepository;
}) {
  const trees = usePeopleQuery(people.trees);
  const [tree, setTree] = useState(initial);
  return (
    <>
      {trees.error && (
        <ErrorState message={trees.error} onRetry={trees.reload} />
      )}
      {(trees.data?.length ?? 0) > 1 && (
        <Choices
          label="Family tree"
          choices={(trees.data ?? []).map(({ id, name }) => ({
            value: id,
            label: name,
          }))}
          value={tree}
          onChange={setTree}
        />
      )}
      <AssistantWorkspace
        key={tree}
        tree={tree}
        repository={assistant}
        people={people}
      />
    </>
  );
}
