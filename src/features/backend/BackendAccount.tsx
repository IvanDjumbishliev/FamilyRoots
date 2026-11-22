import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LoadingState } from '@/components/LoadingState';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import {
  getBackendClient,
  refreshSessionInForeground,
  type BackendClient,
} from '@/lib/supabase';
import { describeBackendError } from '@/services/supabaseFamilyRepository';

import { ConnectedFamily } from './ConnectedFamily';

export function BackendAccount() {
  const [state, setState] = useState<
    | { kind: 'loading' | 'disabled' | 'invalid' }
    | { kind: 'ready'; client: BackendClient; session: Session | null }
  >({ kind: 'loading' });

  useEffect(() => {
    let client;
    try {
      client = getBackendClient();
    } catch {
      setState({ kind: 'invalid' });
      return;
    }
    if (!client) {
      setState({ kind: 'disabled' });
      return;
    }
    const backend = client;
    const refresh = refreshSessionInForeground(backend);
    const {
      data: { subscription },
    } = backend.auth.onAuthStateChange((_event, session) => {
      setState({ kind: 'ready', client: backend, session });
    });
    return () => {
      subscription.unsubscribe();
      refresh?.();
    };
  }, []);

  return (
    <Card>
      <Type variant="heading" accessibilityRole="header">
        Account settings
      </Type>
      {state.kind === 'loading' && <LoadingState label="Checking account…" />}
      {state.kind === 'disabled' && (
        <Type tone="muted">
          Connect a Supabase project to sign in. The demo workspace is available
          below.
        </Type>
      )}
      {state.kind === 'invalid' && (
        <Type tone="danger" accessibilityRole="alert">
          Set a valid Supabase URL and publishable key together, then restart
          Expo.
        </Type>
      )}
      {state.kind === 'ready' &&
        (state.session ? (
          <ConnectedFamily
            key={state.session.user.id}
            client={state.client}
            userId={state.session.user.id}
          />
        ) : (
          <SignIn client={state.client} />
        ))}
    </Card>
  );
}

function SignIn({ client }: { client: BackendClient }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (busy) return;
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (result.error) throw result.error;
    } catch (error) {
      setError(describeBackendError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Type tone="muted">
        Sign in with an existing Supabase account to access your private family
        trees.
      </Type>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={() => void submit()}
      />
      {error && (
        <Type tone="danger" accessibilityRole="alert">
          {error}
        </Type>
      )}
      <Button
        label={busy ? 'Signing in…' : 'Sign in'}
        disabled={busy}
        onPress={() => void submit()}
      />
    </>
  );
}
