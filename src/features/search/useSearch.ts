import { useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { usePeople } from '@/features/people/usePeople';
import { createSearchRepository } from '@/services/searchRepository';

export function useSearch() {
  const auth = useAuth();
  const client =
    auth.kind === 'ready' && auth.session ? auth.client : undefined;
  const { repository: peopleRepo, firstTree } = usePeople();

  const repository = useMemo(
    () => (client ? createSearchRepository(client) : undefined),
    [client],
  );

  return { repository, peopleRepo, firstTree };
}
