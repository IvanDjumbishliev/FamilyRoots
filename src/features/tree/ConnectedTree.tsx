import { useCallback, useMemo } from 'react';

import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePeopleQuery } from '@/features/people/usePeople';
import { createRelationshipRepository } from '@/services/relationshipRepository';

import { TreeExplorer } from './TreeExplorer';

export function ConnectedTree({
  treeId,
  canEdit,
}: {
  treeId: string;
  canEdit: boolean;
}) {
  const auth = useAuth();
  const client = auth.kind === 'ready' ? auth.client : undefined;
  const repository = useMemo(
    () => client && createRelationshipRepository(client),
    [client],
  );
  const read = useCallback(async () => {
    if (!repository) throw new Error('A connected tree is required.');
    return repository.read(treeId);
  }, [repository, treeId]);
  const query = usePeopleQuery(read);
  const people = useMemo(
    () =>
      query.data?.people
        .filter((person) => !person.archived_at && !person.is_draft)
        .map((person) => ({
          id: person.id,
          name: person.display_name,
          aliases: [
            ...person.alternative_names,
            ...(person.birth_name ? [person.birth_name] : []),
          ],
        }))
        .sort((a, b) => a.name.localeCompare(b.name)) ?? [],
    [query.data],
  );
  if (query.error)
    return (
      <Card>
        <ErrorState message={query.error} onRetry={query.reload} />
      </Card>
    );
  if (!query.data)
    return (
      <Card>
        <LoadingState label="Loading family tree…" />
      </Card>
    );
  return (
    <TreeExplorer
      people={people}
      connections={query.data.connections}
      canEdit={canEdit}
    />
  );
}
