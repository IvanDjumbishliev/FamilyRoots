import { Redirect, useLocalSearchParams } from 'expo-router';

import { PersonDetail } from '@/features/people/PersonDetail';
import { usePeople } from '@/features/people/usePeople';
import { isRecordId } from '@/services/peopleRepository';

export default function PersonProfileRoute() {
  const { repository } = usePeople();
  const { personId } = useLocalSearchParams<{ personId?: string }>();
  if (!repository || !isRecordId(personId))
    return <Redirect href="/family-tree" />;
  return <PersonDetail repository={repository} personId={personId} />;
}
