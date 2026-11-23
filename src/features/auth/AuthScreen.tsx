import { StatusBar } from 'expo-status-bar';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { Wordmark } from '@/components/Wordmark';
import { useTheme } from '@/hooks/useTheme';

export function AuthScreen({
  children,
  title,
  description,
}: PropsWithChildren<{ title: string; description?: string }>) {
  const { theme, mode } = useTheme();
  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Screen>
        <View
          style={{ width: '100%', maxWidth: 500, alignSelf: 'center', gap: 20 }}
        >
          <Wordmark />
          <PageHeading title={title} description={description} />
          <Card>{children}</Card>
        </View>
      </Screen>
    </SafeAreaView>
  );
}

export function AuthStatus({
  title,
  error,
  onRetry,
}: {
  title: string;
  error?: string;
  onRetry?: () => void;
}) {
  return (
    <AuthScreen title="Your account">
      {error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : (
        <LoadingState label={title} />
      )}
    </AuthScreen>
  );
}
