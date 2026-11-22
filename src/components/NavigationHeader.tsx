import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/Wordmark';
import { useTheme } from '@/hooks/useTheme';

export function NavigationHeader() {
  const { theme } = useTheme();
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <View
        style={{ paddingHorizontal: theme.spacing.md, paddingVertical: 10 }}
      >
        <Wordmark />
      </View>
    </SafeAreaView>
  );
}
