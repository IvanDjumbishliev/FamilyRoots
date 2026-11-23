import { Redirect, useLocalSearchParams } from 'expo-router';

import { TimelineDetail } from '@/features/timeline/TimelineDetail';
import { useTimeline } from '@/features/timeline/useTimeline';
import { isRecordId } from '@/services/peopleRepository';

export default function TimelineDetailRoute() {
  const { repository } = useTimeline();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  if (!repository || !isRecordId(eventId)) return <Redirect href="/timeline" />;
  return <TimelineDetail repository={repository} eventId={eventId} />;
}
