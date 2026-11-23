import { Stack } from 'expo-router';

import { AuthProvider } from '@/features/auth/AuthProvider';
import { ThemeProvider } from '@/hooks/useTheme';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
      </AuthProvider>
    </ThemeProvider>
  );
}
