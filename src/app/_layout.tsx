import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { NavigationHeader } from '@/components/NavigationHeader';
import { PrimaryNavigation } from '@/components/PrimaryNavigation';
import { FamilyProvider } from '@/features/family/useFamily';
import { useLayout } from '@/hooks/useLayout';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';

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

export default function RootLayout() {
  return (
    <ThemeProvider>
      <FamilyProvider>
        <Shell />
      </FamilyProvider>
    </ThemeProvider>
  );
}
