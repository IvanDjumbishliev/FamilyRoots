import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  getBackendClient,
  refreshSessionInForeground,
  type BackendClient,
} from '@/lib/supabase';
import {
  createAccountRepository,
  type Account,
} from '@/services/accountRepository';

type Connection =
  | { kind: 'loading' }
  | { kind: 'demo' }
  | { kind: 'invalid' }
  | { kind: 'ready'; client: BackendClient; session: Session | null };

type AuthContextValue = Connection & {
  account?: Account;
  accountError?: string;
  reload: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [connection, setConnection] = useState<Connection>({ kind: 'loading' });
  const [state, setState] = useState<{
    user: string;
    data?: Account;
    error?: string;
  }>();
  const [request, setRequest] = useState(0);
  const client = connection.kind === 'ready' ? connection.client : undefined;
  const userId =
    connection.kind === 'ready' ? connection.session?.user.id : undefined;

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;
    void getBackendClient()
      .then((backend) => {
        if (!active) return;
        if (!backend) {
          setConnection({ kind: 'demo' });
          return;
        }
        const refresh = refreshSessionInForeground(backend);
        const {
          data: { subscription },
        } = backend.auth.onAuthStateChange((_event, session) => {
          if (!session) setState(undefined);
          setConnection({ kind: 'ready', client: backend, session });
        });
        cleanup = () => {
          subscription.unsubscribe();
          refresh?.();
        };
      })
      .catch(() => {
        if (active) setConnection({ kind: 'invalid' });
      });
    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    if (!client || !userId) return;
    let active = true;
    void createAccountRepository(client)
      .read(userId)
      .then(
        (data) => {
          if (active) setState({ user: userId, data });
        },
        () => {
          if (active)
            setState({
              user: userId,
              error:
                'Couldn’t load your account. Check your connection and try again.',
            });
        },
      );
    return () => {
      active = false;
    };
  }, [client, request, userId]);

  return (
    <AuthContext.Provider
      value={{
        ...connection,
        account: userId && state?.user === userId ? state.data : undefined,
        accountError:
          userId && state?.user === userId ? state.error : undefined,
        reload: () => setRequest((previous) => previous + 1),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider is required.');
  return auth;
}
