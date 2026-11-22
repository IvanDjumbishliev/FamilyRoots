import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type Props = TextProps & {
  variant?: 'display' | 'title' | 'heading' | 'body' | 'label' | 'detail';
  tone?: 'text' | 'muted' | 'accent' | 'danger' | 'success';
};

export function Type({
  variant = 'body',
  tone = 'text',
  style,
  ...props
}: Props) {
  const { theme } = useTheme();
  return (
    <Text
      {...props}
      style={[theme.typography[variant], { color: theme.colors[tone] }, style]}
    />
  );
}
