import { Platform } from 'react-native';

import { brand, darkColors, lightColors } from '@/constants/palette';

const shared = {
  typography: {
    display: {
      fontFamily: Platform.select({
        ios: 'Georgia',
        android: 'serif',
        web: 'Georgia, serif',
      }),
      fontSize: 56,
      lineHeight: 62,
      fontWeight: '400',
    },
    title: { fontSize: 32, lineHeight: 39, fontWeight: '700' },
    heading: { fontSize: 22, lineHeight: 29, fontWeight: '600' },
    body: { fontSize: 16, lineHeight: 25 },
    label: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
    detail: { fontSize: 14, lineHeight: 20 },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borders: { width: 1, control: 10, card: 18, hero: 26 },
  layout: { contentWidth: 1120, controlHeight: 48, tablet: 640, desktop: 1024 },
} as const;

function createTheme(colors: typeof lightColors, shadow: string) {
  return {
    ...shared,
    brand,
    colors,
    shadows: {
      card: Platform.select({
        android: { elevation: 2 },
        default: { boxShadow: shadow },
      }),
    },
  };
}

export const themes = {
  light: createTheme(lightColors, '0px 3px 18px rgba(38, 49, 45, 0.06)'),
  dark: createTheme(darkColors, '0px 3px 18px rgba(0, 0, 0, 0.22)'),
};

export type Theme = (typeof themes)['light'];
export type AppearancePreference = 'system' | keyof typeof themes;
