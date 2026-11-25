import { Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';

const paths = {
  tree: 'M12 20v-9m0 4C7 15 4 12 4 7c4 0 7 2 8 5 1-5 4-8 8-8 0 6-3 10-8 11m-4 5h8',
  search: 'M16 16l5 5M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  archive: 'M4 8h16v12H4zM3 4h18v4H3zm6 8h6',
  book: 'M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14',
  add: 'M12 5v14M5 12h14',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
  home: 'm3 10 9-7 9 7v10h-6v-6H9v6H3z',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  grid: 'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  check: 'm5 12 4 4L19 6',
  alert: 'M12 8v5m0 3v.01M10.4 4.8 3 18h18L13.6 4.8a1.8 1.8 0 0 0-3.2 0Z',
  close: 'm6 6 12 12M18 6 6 18',
  sun: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  person: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 20c0-4 3-6 8-6s8 2 8 6',
  bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const { theme } = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessible={Platform.OS === 'web' ? undefined : false}
      aria-hidden
    >
      <Path
        d={paths[name]}
        fill="none"
        stroke={color ?? theme.colors.text}
        strokeWidth={1.65}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
