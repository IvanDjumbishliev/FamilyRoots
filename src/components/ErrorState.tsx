import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { theme } from '@/constants/theme';

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card>
      <Text accessibilityRole="alert" style={styles.message}>
        {message}
      </Text>
      {onRetry && <Button label="Try again" onPress={onRetry} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  message: { ...theme.typography.body, color: theme.colors.danger },
});
