import { ActionLink } from '@/components/ActionLink';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { RequestError } from '@/features/auth/AccountFields';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthScreen, AuthStatus } from '@/features/auth/AuthScreen';
import { useAuthRequest } from '@/features/auth/useAuthRequest';
import { createAccountRepository } from '@/services/accountRepository';

export default function CreateFirstFamilyTree() {
  const auth = useAuth();
  const { invitedTree } = useLocalSearchParams<{ invitedTree?: string }>();
  if (auth.kind === 'loading')
    return <AuthStatus title="Checking your account…" />;
  if (auth.kind === 'demo') return <Redirect href="/" />;
  if (auth.kind !== 'ready' || !auth.session)
    return <Redirect href="/welcome" />;
  if (!auth.account)
    return (
      <AuthStatus
        title="Loading your account…"
        error={auth.accountError}
        onRetry={auth.reload}
      />
    );
  if (auth.account.treeId && auth.account.profile.display_name.trim())
    return (
      <Redirect
        href={
          typeof invitedTree === 'string' &&
          /^[0-9a-f-]{36}$/i.test(invitedTree)
            ? { pathname: '/collaboration', params: { treeId: invitedTree } }
            : '/'
        }
      />
    );

  return (
    <OnboardingForm
      key={auth.session.user.id}
      initialName={auth.account.profile.display_name}
      needsTree={!auth.account.treeId}
      save={async (name, tree) => {
        await createAccountRepository(auth.client).onboard(name, tree);
        auth.reload();
      }}
      logout={async () => {
        const { error } = await auth.client.auth.signOut({ scope: 'local' });
        if (error) throw error;
      }}
    />
  );
}

function OnboardingForm({
  initialName,
  needsTree,
  save,
  logout,
}: {
  initialName: string;
  needsTree: boolean;
  save: (name: string, tree: string) => Promise<void>;
  logout: () => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [tree, setTree] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);
  const request = useAuthRequest();

  function submit() {
    setSubmitted(true);
    if (!name.trim() || (needsTree && !tree.trim())) return;
    void request.submit(
      'onboarding',
      2,
      async () => {
        await save(name.trim(), tree.trim());
        setSaved(true);
      },
      'Couldn’t finish setup. Check your connection and try again.',
    );
  }

  return (
    <AuthScreen
      title={
        needsTree ? 'Create your first family tree' : 'Complete your profile'
      }
    >
      <Type tone="muted">Step 2 of 2 · Your email is verified</Type>
      <TextField
        label="Display name"
        value={name}
        onChangeText={setName}
        maxLength={120}
        error={submitted && !name.trim() ? 'Enter a display name.' : undefined}
      />
      {needsTree && (
        <TextField
          label="Family tree name"
          value={tree}
          onChangeText={setTree}
          maxLength={120}
          error={
            submitted && !tree.trim() ? 'Enter a family tree name.' : undefined
          }
        />
      )}
      {needsTree && (
        <ActionLink
          href="/invitations"
          label="I have a tree invitation"
          variant="secondary"
        />
      )}
      <RequestError message={request.message} />
      <Button
        label={saved ? 'Opening your account…' : 'Finish setup'}
        disabled={request.busy || saved}
        onPress={submit}
      />
      <Button
        label="Log out"
        variant="quiet"
        disabled={request.busy}
        onPress={() =>
          void request.submit(
            'logout',
            2,
            logout,
            'Couldn’t log out. Try again.',
          )
        }
      />
    </AuthScreen>
  );
}
