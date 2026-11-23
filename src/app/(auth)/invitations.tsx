import { useRouter } from 'expo-router';
import { useState } from 'react';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { Type } from '@/components/Type';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthScreen, AuthStatus } from '@/features/auth/AuthScreen';
import { useCollaboration } from '@/features/collaboration/useCollaboration';
import { useSave } from '@/features/family/useSave';
import { usePeopleQuery } from '@/features/people/usePeople';
import {
  collaborationError,
  type CollaborationRepository,
} from '@/services/collaborationRepository';

export default function InvitationsRoute() {
  const auth = useAuth();
  const { repository } = useCollaboration();
  if (auth.kind === 'loading')
    return <AuthStatus title="Checking your account…" />;
  if (!repository)
    return (
      <AuthScreen
        title="Tree invitations"
        description="Sign in with the verified email address that received the invitation."
      >
        {auth.kind === 'ready' ? (
          <>
            <ActionLink
              href={{ pathname: '/log-in', params: { next: 'invitations' } }}
              label="Log in"
            />
            <ActionLink
              href={{ pathname: '/sign-up', params: { next: 'invitations' } }}
              label="Create an account"
              variant="secondary"
            />
          </>
        ) : (
          <ActionLink href="/" label="Back to home" />
        )}
      </AuthScreen>
    );
  return <Inbox repository={repository} reloadAccount={auth.reload} />;
}
function Inbox({
  repository,
  reloadAccount,
}: {
  repository: CollaborationRepository;
  reloadAccount: () => void;
}) {
  const router = useRouter();
  const query = usePeopleQuery(repository.inbox);
  const request = useSave();
  const [message, setMessage] = useState('');
  function respond(id: string, accept: boolean) {
    void request.save(
      async () => {
        try {
          const tree = await repository.respond(id, accept);
          if (accept) {
            reloadAccount();
            router.replace({
              pathname: '/create-first-family-tree',
              params: { invitedTree: tree },
            });
          } else {
            setMessage('Invitation declined.');
            query.reload();
          }
        } catch (error) {
          setMessage(await collaborationError(error));
          throw error;
        }
      },
      () => undefined,
    );
  }
  return (
    <AuthScreen
      title="Tree invitations"
      description="You can see a tree and its records after accepting its invitation."
    >
      {query.error ? (
        <ErrorState message={query.error} onRetry={query.reload} />
      ) : !query.data ? (
        <LoadingState label="Loading invitations…" />
      ) : !query.data.length ? (
        <Type tone="muted">No pending invitations for this account.</Type>
      ) : (
        query.data.map((invite) => (
          <InboxItem
            key={invite.id}
            role={invite.role}
            expires={invite.expires_at}
            busy={request.saving}
            accept={() => respond(invite.id, true)}
            decline={() => respond(invite.id, false)}
          />
        ))
      )}
      {message && <Type accessibilityLiveRegion="polite">{message}</Type>}
      <ActionLink href="/" label="Continue to FamilyRoots AI" variant="quiet" />
    </AuthScreen>
  );
}
function InboxItem({
  role,
  expires,
  busy,
  accept,
  decline,
}: {
  role: string;
  expires: string;
  busy: boolean;
  accept: () => void;
  decline: () => void;
}) {
  return (
    <>
      <Type variant="heading">Private family tree invitation</Type>
      <Type tone="muted">
        {role === 'editor' ? 'Editor' : 'Viewer'} · Expires{' '}
        {new Date(expires).toLocaleDateString()}
      </Type>
      <Button label="Accept invitation" disabled={busy} onPress={accept} />
      <Button
        label="Decline invitation"
        variant="quiet"
        disabled={busy}
        onPress={decline}
      />
    </>
  );
}
