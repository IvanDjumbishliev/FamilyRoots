import { ActionLink } from '@/components/ActionLink';
import { Card } from '@/components/Card';
import { Type } from '@/components/Type';
import { useAuth } from '@/features/auth/AuthProvider';

import { ConnectedFamily } from './ConnectedFamily';

export function BackendAccount() {
  const auth = useAuth();
  return (
    <Card>
      <Type variant="heading" accessibilityRole="header">
        Account settings
      </Type>
      {auth.kind === 'demo' && (
        <Type tone="muted">
          Connect a Supabase project to enable accounts. The demo workspace is
          available below.
        </Type>
      )}
      {auth.kind === 'ready' && auth.session && (
        <>
          <ActionLink
            href="/profile"
            label="Edit user profile"
            variant="secondary"
          />
          <ConnectedFamily
            key={auth.session.user.id}
            client={auth.client}
            userId={auth.session.user.id}
          />
        </>
      )}
    </Card>
  );
}
