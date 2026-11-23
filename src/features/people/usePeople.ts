import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { createPeopleRepository } from '@/services/peopleRepository';

export function usePeople() {
  const auth = useAuth();
  const client = auth.kind === 'ready' ? auth.client : undefined;
  const user = auth.kind === 'ready' ? auth.session?.user.id : undefined;
  const repository = useMemo(
    () => (client && user ? createPeopleRepository(client, user) : undefined),
    [client, user],
  );
  return { repository, firstTree: auth.account?.treeId };
}

export function usePeopleQuery<T>(read: () => Promise<T>) {
  const [state, setState] = useState<{
    key: typeof read;
    revision: number;
    data?: T;
    error?: string;
  }>();
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let current = true;
      void read().then(
        (data) => {
          if (current) setState({ key: read, revision, data });
        },
        () => {
          if (current)
            setState({
              key: read,
              revision,
              error:
                'Couldn’t load this record. Check your connection or tree access.',
            });
        },
      );
      return () => {
        current = false;
      };
    }, [read, revision]),
  );
  return {
    ...(state?.key === read &&
    (state.data !== undefined || state.revision === revision)
      ? state
      : undefined),
    reload: () => setRevision((value) => value + 1),
  };
}
