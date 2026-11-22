import { Link, usePathname } from 'expo-router';
import { useState, type Ref } from 'react';
import { Platform, View, type PressableProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { Type } from '@/components/Type';
import { Wordmark } from '@/components/Wordmark';
import { LinkPressable } from '@/components/LinkPressable';
import { useTheme } from '@/hooks/useTheme';

const destinations = [
  { href: '/', label: 'Home', short: 'Home', icon: 'home' },
  { href: '/family-tree', label: 'Family Tree', short: 'Tree', icon: 'tree' },
  { href: '/discover', label: 'Discover', short: 'Discover', icon: 'search' },
  {
    href: '/family-archive',
    label: 'Family Archive',
    short: 'Archive',
    icon: 'archive',
  },
  { href: '/my-books', label: 'My Books', short: 'Books', icon: 'book' },
  { href: '/settings', label: 'Settings', short: 'Settings', icon: 'settings' },
] as const;

type ItemProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  short: string;
  icon: IconName;
  sidebar: boolean;
  active: boolean;
  ref?: Ref<View>;
};

function NavigationItem({
  label,
  short,
  icon,
  sidebar,
  active,
  onFocus,
  onBlur,
  ...props
}: ItemProps) {
  const {
    theme: { colors },
  } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <LinkPressable
      {...props}
      {...(Platform.OS === 'web' && active ? { 'aria-current': 'page' } : {})}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onFocus={(event) => {
        setFocus(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocus(false);
        onBlur?.(event);
      }}
      style={({ pressed }) => ({
        flex: sidebar ? undefined : 1,
        minWidth: 0,
        minHeight: sidebar ? 48 : 58,
        flexDirection: sidebar ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: sidebar ? 'flex-start' : 'center',
        gap: sidebar ? 12 : 3,
        paddingHorizontal: sidebar ? 12 : 0,
        paddingVertical: 4,
        borderRadius: 10,
        backgroundColor: active || pressed ? colors.subtle : 'transparent',
        outlineStyle: focus ? 'solid' : undefined,
        outlineWidth: focus ? 2 : undefined,
        outlineColor: focus ? colors.focus : undefined,
        outlineOffset: focus ? -2 : undefined,
      })}
    >
      <Icon
        name={icon}
        size={sidebar ? 20 : 18}
        color={active ? colors.primary : colors.muted}
      />
      <Type
        variant="label"
        style={{
          color: active ? colors.primary : colors.muted,
          ...(sidebar
            ? {}
            : { fontSize: 10, lineHeight: 14, textAlign: 'center' }),
        }}
      >
        {sidebar ? label : short}
      </Type>
    </LinkPressable>
  );
}

export function PrimaryNavigation({ sidebar }: { sidebar: boolean }) {
  const pathname = usePathname();
  const {
    theme: { colors },
  } = useTheme();
  return (
    <SafeAreaView
      edges={sidebar ? ['top', 'left', 'bottom'] : ['left', 'right', 'bottom']}
      style={
        sidebar
          ? {
              width: 222,
              backgroundColor: colors.surface,
              borderRightWidth: 1,
              borderColor: colors.border,
            }
          : {
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderColor: colors.border,
            }
      }
    >
      {sidebar && (
        <View
          style={{ paddingHorizontal: 18, paddingTop: 24, paddingBottom: 30 }}
        >
          <Wordmark />
        </View>
      )}
      <View
        role={Platform.OS === 'web' ? 'navigation' : undefined}
        accessibilityLabel="Main navigation"
        style={{
          flexDirection: sidebar ? 'column' : 'row',
          paddingHorizontal: sidebar ? 12 : 4,
          paddingVertical: 4,
          gap: sidebar ? 6 : 1,
        }}
      >
        {destinations.map(({ href, ...destination }) => {
          const exact = pathname === href;
          const active =
            exact || (href !== '/' && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              push
              asChild
              onPress={(event) => {
                if (exact) event.preventDefault();
              }}
            >
              <NavigationItem
                {...destination}
                active={active}
                sidebar={sidebar}
              />
            </Link>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
