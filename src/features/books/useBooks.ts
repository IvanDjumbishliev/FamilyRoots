import { useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { usePeople } from '@/features/people/usePeople';
import { createBookRepository } from '@/services/bookRepository';
import { createArchiveRepository } from '@/services/archiveRepository';

export function useBooks() {
  const auth = useAuth();
  const client =
    auth.kind === 'ready' && auth.session ? auth.client : undefined;
  const user = auth.kind === 'ready' ? auth.session?.user.id : undefined;
  const { repository: people, firstTree } = usePeople();
  const repository = useMemo(
    () => (client ? createBookRepository(client) : undefined),
    [client],
  );
  const archive = useMemo(
    () => (client && user ? createArchiveRepository(client, user) : undefined),
    [client, user],
  );
  return { repository, people, archive, firstTree };
}
