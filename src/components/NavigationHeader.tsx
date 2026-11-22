import { Link, usePathname, type Href } from 'expo-router';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import type { IconName } from '@/components/Icon';
import { Wordmark } from '@/components/Wordmark';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/hooks/useTheme';

const links: { href: Href; label: string; icon: IconName }[] = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
  ...(__DEV__
    ? [{ href: '/showcase', label: 'Showcase', icon: 'grid' } as const]
    : []),
];

export function NavigationHeader() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const { gutter, tablet } = useLayout();
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <View
        style={{
          width: '100%',
          paddingHorizontal: gutter,
          paddingVertical: tablet ? 14 : 10,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: theme.layout.contentWidth,
            alignSelf: 'center',
            flexDirection: tablet ? 'row' : 'column',
            alignItems: tablet ? 'center' : 'flex-start',
            justifyContent: 'space-between',
            gap: tablet ? 16 : 8,
          }}
        >
          <Wordmark />
          <View
            role={Platform.OS === 'web' ? 'navigation' : undefined}
            accessibilityLabel="Main navigation"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}
          >
            {links.map(({ href, label, icon }) => (
              <Link key={label} href={href} asChild>
                <Button
                  {...(Platform.OS === 'web' && pathname === href
                    ? { 'aria-current': 'page' }
                    : {})}
                  label={label}
                  icon={icon}
                  variant="quiet"
                  selected={pathname === href}
                  accessibilityState={{ selected: pathname === href }}
                />
              </Link>
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
