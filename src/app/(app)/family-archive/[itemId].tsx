import { Redirect, useLocalSearchParams } from 'expo-router';

import { ArchiveDetail } from '@/features/archive/ArchiveDetail';
import { useArchive } from '@/features/archive/useArchive';
import { isRecordId } from '@/services/peopleRepository';

export default function ItemRoute() {
  const { repository, userId } = useArchive();
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  if (!repository || !userId || !isRecordId(itemId))
    return <Redirect href="/family-archive" />;
  return (
    <ArchiveDetail repository={repository} userId={userId} itemId={itemId} />
  );
}
