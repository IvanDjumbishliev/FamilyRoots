import { Redirect, useLocalSearchParams } from 'expo-router';

import { PersonDetail } from '@/features/people/PersonDetail';
import { usePeople } from '@/features/people/usePeople';
import { DemoTreeProfile } from '@/features/tree/DemoTreeProfile';
import { isRecordId } from '@/services/peopleRepository';

export default function PersonProfileRoute() {
  const { repository } = usePeople();
  const { personId, addRelative } = useLocalSearchParams<{
    personId?: string;
    addRelative?: string;
  }>();
  if (!repository && typeof personId === 'string')
    return <DemoTreeProfile personId={personId} />;
  if (!repository || !isRecordId(personId))
    return <Redirect href="/family-tree" />;
  return (
    <PersonDetail
      repository={repository}
      personId={personId}
      addRelative={addRelative === '1'}
    />
  );
}
