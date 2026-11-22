import { useWindowDimensions } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export function useLayout() {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const desktop = width >= theme.layout.desktop;
  const tablet = width >= theme.layout.tablet;
  return {
    desktop,
    tablet,
    gutter: desktop
      ? theme.spacing.xxl
      : tablet
        ? theme.spacing.xl
        : theme.spacing.md,
  };
}
