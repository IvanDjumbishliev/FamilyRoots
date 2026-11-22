import { useState, type Ref } from 'react';
import { Pressable, Text, View, type PressableProps } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/hooks/useTheme';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'quiet' | 'hero';
  selected?: boolean;
  ref?: Ref<View>;
};

export function Button({
  label,
  icon,
  variant = 'primary',
  selected = false,
  disabled,
  accessibilityRole = 'button',
  onFocus,
  onBlur,
  ...props
}: Props) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const { colors } = theme;
  const foreground = disabled
    ? colors.muted
    : variant === 'primary'
      ? colors.onPrimary
      : variant === 'hero'
        ? theme.brand.forest
        : colors.text;
  const background =
    variant === 'primary'
      ? colors.primary
      : variant === 'hero'
        ? theme.brand.ivory
        : 'transparent';

  return (
    <Pressable
      {...props}
      accessibilityRole={accessibilityRole}
      accessibilityState={{
        ...props.accessibilityState,
        disabled: disabled ?? undefined,
      }}
      disabled={disabled}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        maxWidth: '100%',
        gap: theme.spacing.sm,
        minHeight: theme.layout.controlHeight,
        paddingHorizontal: variant === 'quiet' ? 12 : 16,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.borders.control,
        backgroundColor: disabled
          ? colors.subtle
          : variant === 'primary' && pressed
            ? colors.primaryPressed
            : (variant === 'quiet' || variant === 'secondary') &&
                (selected || pressed)
              ? colors.subtle
              : background,
        borderWidth: 1,
        borderColor:
          variant === 'secondary'
            ? selected
              ? colors.primary
              : colors.inputBorder
            : 'transparent',
        outlineStyle: focused ? 'solid' : undefined,
        outlineWidth: focused ? 2 : undefined,
        outlineColor: focused
          ? variant === 'hero'
            ? theme.brand.gold
            : colors.focus
          : undefined,
        outlineOffset: focused ? 2 : undefined,
      })}
    >
      {icon && <Icon name={icon} size={18} color={foreground} />}
      <Text
        style={[theme.typography.label, { color: foreground, flexShrink: 1 }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
