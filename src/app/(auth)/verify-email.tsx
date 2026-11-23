import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Type } from '@/components/Type';
import {
  CodeField,
  EmailField,
  RequestError,
} from '@/features/auth/AccountFields';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  emailDestination,
  emailInstructions,
} from '@/features/auth/authRequest';
import { AuthScreen, AuthStatus } from '@/features/auth/AuthScreen';
import { useAuthRequest } from '@/features/auth/useAuthRequest';
import { codeSchema, emailSchema } from '@/features/auth/validation';

export default function VerifyEmail() {
  const auth = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const request = useAuthRequest();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [checkedEmail, setCheckedEmail] = useState(false);
  const [checkedCode, setCheckedCode] = useState(false);
  const [sent, setSent] = useState(false);
  const emailInput = emailSchema.safeParse(email.trim());
  const codeInput = codeSchema.safeParse(code.trim());
  if (auth.kind === 'loading')
    return <AuthStatus title="Checking your account…" />;
  if (auth.kind !== 'ready') return <Redirect href="/" />;
  if (auth.session)
    return <Redirect href={next === 'invitations' ? '/invitations' : '/'} />;
  const client = auth.client;

  function verify() {
    setCheckedEmail(true);
    setCheckedCode(true);
    if (!emailInput.success || !codeInput.success) return;
    void request.submit(
      'code',
      2,
      async () => {
        const { error } = await client.auth.verifyOtp({
          email: emailInput.data,
          token: codeInput.data,
          type: 'email',
        });
        if (error) throw error;
        setCode('');
      },
      'That code could not be verified. Check it or request a new one.',
    );
  }

  function resend() {
    setCheckedEmail(true);
    if (!emailInput.success) return;
    void request.submit(
      'email',
      30,
      async () => {
        await client.auth.resend({
          type: 'signup',
          email: emailInput.data,
          options: { emailRedirectTo: emailDestination('/verify-email') },
        });
        setSent(true);
      },
      'Couldn’t send the request. Check your connection and try again.',
    );
  }

  return (
    <AuthScreen
      title="Verify your email"
      description="Enter your email address and the six-digit confirmation code from your inbox."
    >
      <EmailField
        value={email}
        onChange={setEmail}
        error={checkedEmail ? emailInput.error?.issues[0]?.message : undefined}
      />
      <CodeField
        value={code}
        onChange={setCode}
        error={checkedCode ? codeInput.error?.issues[0]?.message : undefined}
      />
      {sent && (
        <Type accessibilityLiveRegion="polite">{emailInstructions}</Type>
      )}
      <RequestError message={request.message} />
      <Button label="Verify email" disabled={request.busy} onPress={verify} />
      <Button
        label="Resend code"
        variant="secondary"
        disabled={request.busy}
        onPress={resend}
      />
      <ActionLink href="/log-in" label="Back to log in" variant="quiet" />
    </AuthScreen>
  );
}
