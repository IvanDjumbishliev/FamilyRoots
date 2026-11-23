import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { ActionLink } from '@/components/ActionLink';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { useFamily } from '@/features/family/useFamily';
import { PeopleDirectory } from '@/features/people/PeopleDirectory';
import { usePeople } from '@/features/people/usePeople';
import { demoTree } from '@/features/tree/demoTree';
import { TreeExplorer } from '@/features/tree/TreeExplorer';
import { isRecordId } from '@/services/peopleRepository';

export default function TreeScreen() {
  const { repository, firstTree } = usePeople();
  const { treeId } = useLocalSearchParams<{ treeId?: string }>();
  const start = isRecordId(treeId) ? treeId : firstTree;
  if (repository && start)
    return (
      <PeopleDirectory
        key={start}
        repository={repository}
        initialTree={start}
      />
    );
  return <DemoTree />;
}

function DemoTree() {
  const { snapshot, workspace } = useFamily();
  const data = useMemo(
    () => demoTree(snapshot, workspace),
    [snapshot, workspace],
  );
  return (
    <Screen>
      <PageHeading
        title="Family Tree"
        description={
          workspace === 'sample'
            ? 'Explore a fictional family with more than 100 people.'
            : 'Build a tree in this demo session.'
        }
      />
      <ActionLink href="/family-tree/add" icon="add" label="Add Person" />
      <TreeExplorer
        key={workspace}
        people={data.people}
        connections={data.connections}
        canEdit
        isDemo
      />
    </Screen>
  );
}
