import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  themes,
  type AppearancePreference,
  type Theme,
} from '@/constants/theme';

const ThemeContext = createContext<{
  theme: Theme;
  mode: keyof typeof themes;
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
} | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<AppearancePreference>('system');
  const mode = preference === 'system' ? (system ?? 'light') : preference;

  return (
    <ThemeContext.Provider
      value={{ theme: themes[mode], mode, preference, setPreference }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('ThemeProvider is required.');
  return context;
}
