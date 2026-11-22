import { StyleSheet, View, type ViewProps } from 'react-native';

import { theme } from '@/constants/theme';

export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  card: {
    ...theme.shadows.card,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: theme.borders.width,
    borderRadius: theme.borders.card,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
});
