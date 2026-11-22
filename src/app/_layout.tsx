import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { NavigationHeader } from '@/components/NavigationHeader';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';

function Shell() {
  const { theme, mode } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <NavigationHeader />
      <Slot />
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  );
}
