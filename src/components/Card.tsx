import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export function Card({ style, ...props }: ViewProps) {
  const { theme } = useTheme();
  return (
    <View
      {...props}
      style={[
        {
          ...theme.shadows.card,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: theme.borders.width,
          borderRadius: theme.borders.card,
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          minWidth: 0,
        },
        style,
      ]}
    />
  );
}
