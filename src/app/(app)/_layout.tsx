import { Redirect, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { NavigationHeader } from '@/components/NavigationHeader';
import { PrimaryNavigation } from '@/components/PrimaryNavigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthStatus } from '@/features/auth/AuthScreen';
import { FamilyProvider } from '@/features/family/useFamily';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/hooks/useTheme';

const actionRoutes = new Set([
  '/family-tree/add',
  '/family-archive/upload',
  '/my-books/create',
]);

function Shell() {
  const { theme, mode } = useTheme();
  const { tablet: sidebar } = useLayout();
  const pathname = usePathname();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: sidebar ? 'row' : 'column',
        backgroundColor: theme.colors.background,
      }}
    >
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {sidebar ? <PrimaryNavigation sidebar /> : <NavigationHeader />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        />
      </View>
      {!sidebar && !actionRoutes.has(pathname) && (
        <PrimaryNavigation sidebar={false} />
      )}
    </View>
  );
}

export default function ProtectedLayout() {
  const auth = useAuth();
  if (auth.kind === 'loading')
    return <AuthStatus title="Checking your account…" />;
  if (auth.kind === 'invalid') return <Redirect href="/welcome" />;
  if (auth.kind === 'ready' && !auth.session)
    return <Redirect href="/welcome" />;
  if (auth.kind === 'ready' && auth.session) {
    if (!auth.account)
      return (
        <AuthStatus
          title="Loading your account…"
          error={auth.accountError}
          onRetry={auth.reload}
        />
      );
    if (!auth.account.treeId || !auth.account.profile.display_name.trim())
      return <Redirect href="/create-first-family-tree" />;
  }
  const accountKey = auth.kind === 'ready' ? auth.session?.user.id : 'demo';
  return (
    <FamilyProvider key={accountKey}>
      <Shell />
    </FamilyProvider>
  );
}
