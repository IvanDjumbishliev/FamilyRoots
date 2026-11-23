import { Redirect } from 'expo-router';
import { useState } from 'react';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import {
  CodeField,
  EmailField,
  PasswordField,
  RequestError,
} from '@/features/auth/AccountFields';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthScreen, AuthStatus } from '@/features/auth/AuthScreen';
import { useAuthRequest } from '@/features/auth/useAuthRequest';
import {
  codeSchema,
  emailSchema,
  passwordSchema,
} from '@/features/auth/validation';
import { createRecoveryClient, type BackendClient } from '@/lib/supabase';

export default function ResetPassword() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [complete, setComplete] = useState(false);
  const [recovery, setRecovery] = useState<BackendClient>();
  const request = useAuthRequest();
  const emailInput = emailSchema.safeParse(email.trim());
  const codeInput = codeSchema.safeParse(code.trim());
  const passwordInput = passwordSchema.safeParse(password);
  if (auth.kind === 'loading')
    return <AuthStatus title="Checking your account…" />;
  if (auth.kind !== 'ready') return <Redirect href="/" />;
  if (complete)
    return (
      <AuthScreen
        title="Password updated"
        description="Log in with your new password."
      >
        <ActionLink href="/log-in" label="Log in" />
      </AuthScreen>
    );

  function submit() {
    setSubmitted(true);
    if (
      !passwordInput.success ||
      (!recovery && (!emailInput.success || !codeInput.success))
    )
      return;
    void request.submit(
      'code',
      2,
      async () => {
        let isolated = recovery;
        if (!isolated && emailInput.success && codeInput.success) {
          isolated = createRecoveryClient();
          const { data, error } = await isolated.auth.verifyOtp({
            email: emailInput.data,
            token: codeInput.data,
            type: 'recovery',
          });
          if (error || !data.session)
            throw error ?? new Error('Recovery session unavailable.');
          setRecovery(isolated);
          setCode('');
        }
        if (!isolated) return;
        const { error } = await isolated.auth.updateUser({
          password: passwordInput.data,
        });
        if (error) throw error;
        setPassword('');
        setRecovery(undefined);
        await isolated.auth.signOut({ scope: 'global' }).catch(() => undefined);
        setComplete(true);
      },
      recovery
        ? 'Couldn’t update your password. Choose a different password or request a new code.'
        : 'Couldn’t reset your password. Check the code and choose a different password if needed.',
    );
  }

  return (
    <AuthScreen
      title="Reset password"
      description={
        recovery
          ? 'Your code is verified. Choose a new password.'
          : 'Enter your email address and the six-digit recovery code.'
      }
    >
      {!recovery && (
        <>
          <EmailField
            value={email}
            onChange={setEmail}
            error={submitted ? emailInput.error?.issues[0]?.message : undefined}
          />
          <CodeField
            value={code}
            onChange={setCode}
            error={submitted ? codeInput.error?.issues[0]?.message : undefined}
          />
        </>
      )}
      <PasswordField
        value={password}
        onChange={setPassword}
        error={submitted ? passwordInput.error?.issues[0]?.message : undefined}
      />
      <RequestError message={request.message} />
      <Button
        label={request.busy ? 'Updating…' : 'Update password'}
        disabled={request.busy}
        onPress={submit}
      />
      <ActionLink
        href="/forgot-password"
        label="Request a new code"
        variant="quiet"
      />
    </AuthScreen>
  );
}
