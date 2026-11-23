import { Redirect } from 'expo-router';
import { useState } from 'react';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Type } from '@/components/Type';
import { EmailField, RequestError } from '@/features/auth/AccountFields';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  emailDestination,
  emailInstructions,
} from '@/features/auth/authRequest';
import { AuthScreen, AuthStatus } from '@/features/auth/AuthScreen';
import { useAuthRequest } from '@/features/auth/useAuthRequest';
import { emailSchema } from '@/features/auth/validation';

export default function ForgotPassword() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sent, setSent] = useState(false);
  const request = useAuthRequest();
  const emailInput = emailSchema.safeParse(email.trim());
  if (auth.kind === 'loading')
    return <AuthStatus title="Checking your account…" />;
  if (auth.kind !== 'ready') return <Redirect href="/" />;
  const client = auth.client;

  function submit() {
    setSubmitted(true);
    if (!emailInput.success) return;
    void request.submit(
      'email',
      30,
      async () => {
        await client.auth.resetPasswordForEmail(emailInput.data, {
          redirectTo: emailDestination('/reset-password'),
        });
        setSent(true);
      },
      'Couldn’t send the request. Check your connection and try again.',
    );
  }

  return (
    <AuthScreen
      title="Forgot password"
      description="Request a one-time code to reset your password."
    >
      <EmailField
        value={email}
        onChange={setEmail}
        error={submitted ? emailInput.error?.issues[0]?.message : undefined}
      />
      {sent && (
        <Type accessibilityLiveRegion="polite">{emailInstructions}</Type>
      )}
      <RequestError message={request.message} />
      <Button
        label={request.busy ? 'Sending…' : 'Send recovery code'}
        disabled={request.busy}
        onPress={submit}
      />
      <ActionLink
        href="/reset-password"
        label="Enter a recovery code"
        variant="secondary"
      />
      <ActionLink href="/log-in" label="Back to log in" variant="quiet" />
    </AuthScreen>
  );
}
