import type { Ref } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { theme } from '@/constants/theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
  ref?: Ref<TextInput>;
};

export function TextField({ label, error, style, ...props }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.muted}
        {...props}
        style={[styles.input, error && styles.invalid, style]}
      />
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: theme.spacing.xs },
  label: { ...theme.typography.label, color: theme.colors.text },
  input: {
    ...theme.typography.body,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    minHeight: theme.layout.controlHeight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: theme.borders.width,
    borderColor: theme.colors.inputBorder,
    borderRadius: theme.borders.control,
  },
  invalid: { borderColor: theme.colors.danger },
  error: { ...theme.typography.label, color: theme.colors.danger },
});
