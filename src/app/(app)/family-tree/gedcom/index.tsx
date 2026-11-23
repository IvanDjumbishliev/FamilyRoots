import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { ActionLink } from '@/components/ActionLink';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { Type } from '@/components/Type';
import { useAuth } from '@/features/auth/AuthProvider';
import { GedcomWorkspace } from '@/features/gedcom/GedcomWorkspace';
import { usePeople, usePeopleQuery } from '@/features/people/usePeople';
import { createGedcomRepository } from '@/services/gedcomRepository';
import { isRecordId } from '@/services/peopleRepository';

export default function GedcomRoute() {
  const auth = useAuth();
  const client = auth.kind === 'ready' ? auth.client : undefined;
  const { repository, firstTree } = usePeople();
  const { treeId } = useLocalSearchParams<{ treeId?: string }>();
  const tree = isRecordId(treeId) ? treeId : firstTree;
  const transfer = useMemo(
    () => client && createGedcomRepository(client),
    [client],
  );
  const read = useMemo(
    () => () =>
      repository && tree ? repository.access(tree) : Promise.resolve(undefined),
    [repository, tree],
  );
  const access = usePeopleQuery(read);
  return (
    <Screen>
      <ActionLink
        href={{ pathname: '/family-tree', params: { treeId: tree } }}
        label="Back to Family Tree"
        variant="quiet"
      />
      <PageHeading
        title="GEDCOM import and export"
        description={access.data?.name}
      />
      {access.error ? (
        <ErrorState message={access.error} onRetry={access.reload} />
      ) : !transfer || !tree ? (
        <Type>Connect and open a family tree to transfer genealogy files.</Type>
      ) : !access.data ? (
        <LoadingState label="Checking tree permissions…" />
      ) : (
        <GedcomWorkspace
          key={tree}
          repository={transfer}
          tree={tree}
          canImport={access.data.canEdit}
          canExport={access.data.role === 'owner'}
        />
      )}
    </Screen>
  );
}
