import { useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { createTimelineRepository } from '@/services/timelineRepository';

export function useTimeline() {
  const auth = useAuth();
  const client = auth.kind === 'ready' ? auth.client : undefined;
  const userId = auth.kind === 'ready' ? auth.session?.user.id : undefined;
  const repository = useMemo(
    () =>
      client && userId ? createTimelineRepository(client, userId) : undefined,
    [client, userId],
  );
  return { repository, treeId: auth.account?.treeId };
}
