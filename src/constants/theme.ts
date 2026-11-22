import { Platform } from 'react-native';

export const theme = {
  colors: {
    background: '#F6F4EE',
    surface: '#FFFFFF',
    text: '#202D25',
    muted: '#4C5C51',
    primary: '#23513A',
    primaryPressed: '#193D2B',
    onPrimary: '#FFFFFF',
    border: '#C9D2CA',
    inputBorder: '#74867A',
    disabled: '#DCE4DC',
    danger: '#9A332E',
  },
  typography: {
    title: { fontSize: 36, lineHeight: 44, fontWeight: '700' },
    heading: { fontSize: 23, lineHeight: 30, fontWeight: '600' },
    body: { fontSize: 17, lineHeight: 26 },
    label: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borders: { width: 1, control: 8, card: 16 },
  shadows: {
    card: Platform.select({
      android: { elevation: 2 },
      default: { boxShadow: '0px 2px 10px rgba(32, 45, 37, 0.08)' },
    }),
  },
  layout: { contentWidth: 800, controlHeight: 48 },
} as const;
