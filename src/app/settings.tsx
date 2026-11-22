import { Link } from 'expo-router';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Tabs } from '@/components/Tabs';
import { Type } from '@/components/Type';
import { useTheme } from '@/hooks/useTheme';

export default function SettingsScreen() {
  const { preference, setPreference } = useTheme();

  return (
    <Screen>
      <Type variant="title" accessibilityRole="header" aria-level={1}>
        Settings
      </Type>
      <Card>
        <Type variant="heading" accessibilityRole="header">
          Appearance
        </Type>
        <Tabs
          label="Appearance"
          value={preference}
          onChange={setPreference}
          items={[
            {
              value: 'system',
              label: 'System',
              content: (
                <Type tone="muted">Follow your device’s color scheme.</Type>
              ),
            },
            {
              value: 'light',
              label: 'Light',
              content: <Type tone="muted">Use the light theme.</Type>,
            },
            {
              value: 'dark',
              label: 'Dark',
              content: <Type tone="muted">Use the dark theme.</Type>,
            },
          ]}
        />
      </Card>
      <Card>
        <Type variant="heading" accessibilityRole="header">
          Account settings
        </Type>
        <Type tone="muted">
          Account settings will be available when sign-in is enabled.
        </Type>
      </Card>
      <Link href="/" asChild>
        <Button variant="quiet" label="Back to home" />
      </Link>
    </Screen>
  );
}
