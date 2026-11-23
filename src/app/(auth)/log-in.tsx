import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import {
  EmailField,
  PasswordField,
  RequestError,
} from '@/features/auth/AccountFields';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthScreen, AuthStatus } from '@/features/auth/AuthScreen';
import { useAuthRequest } from '@/features/auth/useAuthRequest';
import { emailSchema } from '@/features/auth/validation';

export default function LogIn() {
  const auth = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const request = useAuthRequest();
  const emailInput = emailSchema.safeParse(email.trim());
  if (auth.kind === 'loading')
    return <AuthStatus title="Checking your account…" />;
  if (auth.kind !== 'ready') return <Redirect href="/" />;
  if (auth.session)
    return <Redirect href={next === 'invitations' ? '/invitations' : '/'} />;
  const client = auth.client;

  function submit() {
    setSubmitted(true);
    if (!emailInput.success || !password) return;
    void request.submit(
      'login',
      2,
      async () => {
        const { error } = await client.auth.signInWithPassword({
          email: emailInput.data,
          password,
        });
        if (error) throw error;
        setPassword('');
      },
      'Couldn’t log in. Check your credentials or verify your email, then try again.',
    );
  }

  return (
    <AuthScreen title="Log in">
      <EmailField
        value={email}
        onChange={setEmail}
        error={submitted ? emailInput.error?.issues[0]?.message : undefined}
      />
      <PasswordField
        existing
        value={password}
        onChange={setPassword}
        error={submitted && !password ? 'Enter your password.' : undefined}
      />
      <RequestError message={request.message} />
      <Button
        label={request.busy ? 'Logging in…' : 'Log in'}
        disabled={request.busy}
        onPress={submit}
      />
      <ActionLink
        href="/forgot-password"
        label="Forgot password?"
        variant="quiet"
      />
      <ActionLink href="/verify-email" label="Verify email" variant="quiet" />
      <ActionLink href="/sign-up" label="Create an account" variant="quiet" />
    </AuthScreen>
  );
}
