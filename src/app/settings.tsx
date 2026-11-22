import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { theme } from '@/constants/theme';

export default function SettingsScreen() {
  return (
    <Screen>
      <Card>
        <Text accessibilityRole="header" style={styles.heading}>
          Account settings
        </Text>
        <Text style={styles.body}>
          Account settings will be available when sign-in is enabled.
        </Text>
      </Card>
      <Link href="/" dismissTo asChild>
        <Button label="Back to home" />
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { ...theme.typography.heading, color: theme.colors.text },
  body: { ...theme.typography.body, color: theme.colors.muted },
});
