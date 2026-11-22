import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { theme } from '@/constants/theme';

export function WelcomeScreen() {
  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Your family history
      </Text>
      <Card>
        <Text accessibilityRole="header" style={styles.heading}>
          Family tree
        </Text>
        <Text style={styles.body}>
          There are no family members in your tree yet.
        </Text>
      </Card>
      <Link href="/settings" asChild>
        <Button label="Settings" />
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...theme.typography.title, color: theme.colors.text },
  heading: { ...theme.typography.heading, color: theme.colors.text },
  body: { ...theme.typography.body, color: theme.colors.muted },
});
