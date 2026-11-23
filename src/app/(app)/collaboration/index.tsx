import { useLocalSearchParams } from 'expo-router';

import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { CollaborationScreen } from '@/features/collaboration/CollaborationScreen';
import { useCollaboration } from '@/features/collaboration/useCollaboration';
import { isRecordId } from '@/services/peopleRepository';

export default function CollaborationRoute() {
  const { repository, treeId } = useCollaboration();
  const params = useLocalSearchParams<{ treeId?: string }>();
  const tree = isRecordId(params.treeId) ? params.treeId : treeId;
  if (repository && tree)
    return (
      <CollaborationScreen
        key={tree}
        repository={repository}
        initialTree={tree}
      />
    );
  return (
    <Screen>
      <PageHeading
        title="Family collaboration"
        description="Sign in to a connected family tree to invite relatives."
      />
    </Screen>
  );
}
