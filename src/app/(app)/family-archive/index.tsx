import { useLocalSearchParams } from 'expo-router';
import { Image } from 'react-native';

import { ActionLink } from '@/components/ActionLink';
import { Card } from '@/components/Card';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { State } from '@/components/State';
import { Type } from '@/components/Type';
import { useFamily } from '@/features/family/useFamily';

import { ArchiveDirectory } from '@/features/archive/ArchiveDirectory';
import { useArchive } from '@/features/archive/useArchive';
import { isRecordId } from '@/services/peopleRepository';

export default function ArchiveScreen() {
  const { repository, treeId: firstTree } = useArchive();
  const { treeId } = useLocalSearchParams<{ treeId?: string }>();
  const tree = isRecordId(treeId) ? treeId : firstTree;
  return repository && tree ? (
    <ArchiveDirectory key={tree} repository={repository} initialTree={tree} />
  ) : (
    <DemoArchive />
  );
}

function DemoArchive() {
  const { snapshot } = useFamily();

  return (
    <Screen>
      <PageHeading
        title="Family Archive"
        description="Photos, documents, and recordings you’ve added."
      />
      <ActionLink
        href="/family-archive/upload"
        icon="upload"
        label="Upload Memory"
      />
      {snapshot.memories.length ? (
        snapshot.memories.map((memory) => (
          <Card key={memory.id}>
            <Type variant="heading" accessibilityRole="header">
              {memory.name}
            </Type>
            <Type variant="detail" tone="muted">
              {memory.mimeType}
            </Type>
            {memory.mimeType.startsWith('image/') && (
              <Image
                source={{ uri: memory.uri }}
                resizeMode="contain"
                accessibilityLabel={memory.name}
                style={{ width: '100%', height: 180 }}
              />
            )}
          </Card>
        ))
      ) : (
        <Card>
          <State
            kind="empty"
            title="No memories yet"
            message="Start with a family photo, a scanned letter, or a recording."
          />
        </Card>
      )}
    </Screen>
  );
}
