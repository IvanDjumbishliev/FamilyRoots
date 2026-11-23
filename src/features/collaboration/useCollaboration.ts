import { useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { createCollaborationRepository } from '@/services/collaborationRepository';

export function useCollaboration() {
  const auth = useAuth();
  const client = auth.kind === 'ready' ? auth.client : undefined;
  const userId = auth.kind === 'ready' ? auth.session?.user.id : undefined;
  const repository = useMemo(
    () =>
      client && userId ? createCollaborationRepository(client) : undefined,
    [client, userId],
  );
  return { repository, userId, treeId: auth.account?.treeId };
}
