import { Redirect } from 'expo-router';

import { ActionLink } from '@/components/ActionLink';
import { Type } from '@/components/Type';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthScreen } from '@/features/auth/AuthScreen';

export default function Welcome() {
  const auth = useAuth();
  if (auth.kind === 'demo' || (auth.kind === 'ready' && auth.session))
    return <Redirect href="/" />;

  return (
    <AuthScreen
      title="Welcome to FamilyRoots AI"
      description="Build a private family tree and keep the stories that go with it."
    >
      {auth.kind === 'invalid' && (
        <Type tone="danger">
          The account service could not start. Check the Supabase configuration
          and restart the app.
        </Type>
      )}
      {auth.kind === 'ready' && (
        <>
          <ActionLink href="/sign-up" label="Create an account" />
          <ActionLink href="/log-in" label="Log in" variant="secondary" />
        </>
      )}
    </AuthScreen>
  );
}
