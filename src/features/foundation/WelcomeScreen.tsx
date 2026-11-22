import { Link } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { State } from '@/components/State';
import { Type } from '@/components/Type';
import { FamilyIllustration } from '@/features/foundation/FamilyIllustration';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/hooks/useTheme';

export function WelcomeScreen() {
  const { theme } = useTheme();
  const { desktop, tablet } = useLayout();

  return (
    <Screen>
      <View
        style={{
          borderRadius: theme.borders.hero,
          backgroundColor: theme.brand.forest,
          padding: desktop ? 48 : 24,
          gap: tablet ? 24 : 16,
          flexDirection: tablet ? 'row' : 'column',
          alignItems: tablet ? 'center' : 'stretch',
        }}
      >
        <View style={{ flex: tablet ? 1.25 : undefined, minWidth: 0, gap: 16 }}>
          <Type variant="label" style={{ color: '#E4CA95' }}>
            YOUR FAMILY HISTORY
          </Type>
          <Type
            variant="display"
            accessibilityRole="header"
            aria-level={1}
            style={{
              color: theme.brand.ivory,
              ...(desktop ? {} : { fontSize: 42, lineHeight: 47 }),
            }}
          >
            Every family has a story.
          </Type>
          <Type style={{ color: '#E0EAE3', maxWidth: 440 }}>
            A place to trace your roots and keep the stories that make your
            family who they are.
          </Type>
        </View>
        <View
          style={{
            flex: tablet ? 1 : undefined,
            width: tablet ? undefined : '100%',
            alignSelf: tablet ? undefined : 'center',
            maxWidth: 400,
            height: desktop ? 236 : 170,
          }}
        >
          <FamilyIllustration />
        </View>
      </View>
      <View style={{ flexDirection: tablet ? 'row' : 'column', gap: 16 }}>
        <Card style={{ flex: tablet ? 1.6 : undefined }}>
          <Type variant="label" tone="accent">
            FAMILY TREE
          </Type>
          <State
            kind="empty"
            title="Your tree is empty"
            message="The people and relationships you add will appear here."
          />
        </Card>
        <Card style={{ flex: tablet ? 1 : undefined }}>
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
            <Icon name="sun" color={theme.colors.accent} />
          </View>
          <Type variant="heading" accessibilityRole="header">
            Appearance
          </Type>
          <Type tone="muted">
            Choose a light or dark theme, or follow your device settings.
          </Type>
          <Link href="/settings" asChild>
            <Button variant="secondary" label="Open settings" icon="arrow" />
          </Link>
        </Card>
      </View>
    </Screen>
  );
}
