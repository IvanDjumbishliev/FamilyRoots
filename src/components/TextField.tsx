import { useId, useState, type Ref } from 'react';
import { Platform, TextInput, View, type TextInputProps } from 'react-native';

import { Type } from '@/components/Type';
import { useTheme } from '@/hooks/useTheme';

type Props = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  ref?: Ref<TextInput>;
};

export function TextField({
  label,
  error,
  hint,
  style,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const messageId = useId();
  const message = error || hint;
  const { colors } = theme;

  return (
    <View style={{ gap: 6 }}>
      <Type variant="label">{label}</Type>
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityHint={
          Platform.OS === 'web'
            ? undefined
            : (message ?? props.accessibilityHint)
        }
        aria-describedby={message ? messageId : undefined}
        aria-invalid={Boolean(error)}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          {
            ...theme.typography.body,
            backgroundColor: colors.surface,
            color: colors.text,
            minHeight: theme.layout.controlHeight,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.inputBorder,
            borderRadius: theme.borders.control,
            outlineStyle: focused ? 'solid' : undefined,
            outlineWidth: focused ? 2 : undefined,
            outlineColor: focused ? colors.focus : undefined,
            outlineOffset: focused ? 2 : undefined,
          },
          style,
        ]}
      />
      {message && (
        <Type
          nativeID={messageId}
          variant="detail"
          tone={error ? 'danger' : 'muted'}
          accessibilityRole={error ? 'alert' : undefined}
        >
          {message}
        </Type>
      )}
    </View>
  );
}
