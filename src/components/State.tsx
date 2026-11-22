import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { Type } from '@/components/Type';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  kind: 'empty' | 'loading' | 'success' | 'error';
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
};

const icons: Record<Exclude<Props['kind'], 'loading'>, IconName> = {
  empty: 'tree',
  success: 'check',
  error: 'alert',
};

export function State({ kind, title, message, action }: Props) {
  const { theme } = useTheme();
  const tone =
    kind === 'error' ? 'danger' : kind === 'success' ? 'success' : 'accent';
  return (
    <View style={{ alignItems: 'flex-start', gap: theme.spacing.sm }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.subtle,
        }}
      >
        {kind === 'loading' ? (
          <ActivityIndicator color={theme.colors.primary} accessible={false} />
        ) : (
          <Icon name={icons[kind]} color={theme.colors[tone]} />
        )}
      </View>
      <View
        accessibilityRole={kind === 'error' ? 'alert' : undefined}
        accessibilityLiveRegion={kind === 'empty' ? undefined : 'polite'}
      >
        <Type
          variant="heading"
          accessibilityRole={kind === 'empty' ? 'header' : undefined}
        >
          {title}
        </Type>
        {message && (
          <Type tone="muted" style={{ marginTop: 4 }}>
            {message}
          </Type>
        )}
      </View>
      {action && (
        <Button
          variant="secondary"
          label={action.label}
          onPress={action.onPress}
        />
      )}
    </View>
  );
}
