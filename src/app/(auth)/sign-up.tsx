import { Redirect, useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import {
  EmailField,
  PasswordField,
  RequestError,
} from '@/features/auth/AccountFields';
import { useAuth } from '@/features/auth/AuthProvider';
import { emailDestination } from '@/features/auth/authRequest';
import { AuthScreen, AuthStatus } from '@/features/auth/AuthScreen';
import { useAuthRequest } from '@/features/auth/useAuthRequest';
import { emailSchema, passwordSchema } from '@/features/auth/validation';

export default function SignUp() {
  const auth = useAuth();
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const request = useAuthRequest();
  const emailInput = emailSchema.safeParse(email.trim());
  const passwordInput = passwordSchema.safeParse(password);
  if (auth.kind === 'loading')
    return <AuthStatus title="Checking your account…" />;
  if (auth.kind !== 'ready') return <Redirect href="/" />;
  if (auth.session)
    return <Redirect href={next === 'invitations' ? '/invitations' : '/'} />;
  const client = auth.client;

  function submit() {
    setSubmitted(true);
    if (!emailInput.success || !passwordInput.success) return;
    void request.submit(
      'email',
      30,
      async () => {
        await client.auth.signUp({
          email: emailInput.data,
          password: passwordInput.data,
          options: { emailRedirectTo: emailDestination('/verify-email') },
        });
        setPassword('');
        router.replace(
          next === 'invitations'
            ? { pathname: '/verify-email', params: { next } }
            : '/verify-email',
        );
      },
      'Couldn’t send the request. Check your connection and try again.',
    );
  }

  return (
    <AuthScreen title="Create your account">
      <EmailField
        value={email}
        onChange={setEmail}
        error={submitted ? emailInput.error?.issues[0]?.message : undefined}
      />
      <PasswordField
        value={password}
        onChange={setPassword}
        error={submitted ? passwordInput.error?.issues[0]?.message : undefined}
      />
      <RequestError message={request.message} />
      <Button
        label={request.busy ? 'Submitting…' : 'Sign up'}
        disabled={request.busy}
        onPress={submit}
      />
      <ActionLink
        href="/log-in"
        label="Already have an account? Log in"
        variant="quiet"
      />
    </AuthScreen>
  );
}
