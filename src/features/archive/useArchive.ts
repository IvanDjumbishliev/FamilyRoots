import { useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { createArchiveRepository } from '@/services/archiveRepository';

export function useArchive() {
  const auth = useAuth();
  const client = auth.kind === 'ready' ? auth.client : undefined;
  const userId = auth.kind === 'ready' ? auth.session?.user.id : undefined;
  const repository = useMemo(
    () =>
      client && userId ? createArchiveRepository(client, userId) : undefined,
    [client, userId],
  );
  return { repository, userId, treeId: auth.account?.treeId };
}
