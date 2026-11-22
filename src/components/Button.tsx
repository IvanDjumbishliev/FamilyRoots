import type { Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from 'react-native';

import { theme } from '@/constants/theme';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  ref?: Ref<View>;
};

export function Button({
  label,
  disabled,
  accessibilityRole = 'button',
  ...props
}: Props) {
  return (
    <Pressable
      {...props}
      accessibilityRole={accessibilityRole}
      accessibilityState={{
        ...props.accessibilityState,
        disabled: disabled ?? undefined,
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, disabled && styles.disabledLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: theme.layout.controlHeight,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borders.control,
    backgroundColor: theme.colors.primary,
  },
  pressed: { backgroundColor: theme.colors.primaryPressed },
  disabled: { backgroundColor: theme.colors.disabled },
  label: { ...theme.typography.label, color: theme.colors.onPrimary },
  disabledLabel: { color: theme.colors.muted },
});
