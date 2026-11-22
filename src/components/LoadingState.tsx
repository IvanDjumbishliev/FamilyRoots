import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      <ActivityIndicator color={theme.colors.primary} accessible={false} />
      <Text
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        style={styles.label}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  label: { ...theme.typography.body, color: theme.colors.muted },
});
