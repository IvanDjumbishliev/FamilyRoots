import { Link } from 'expo-router';
import { View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { LinkPressable } from '@/components/LinkPressable';
import { Type } from '@/components/Type';
import { useTheme } from '@/hooks/useTheme';

import { TreeGestureSurface } from './TreeGestureSurface';
import {
  inView,
  overlaps,
  viewBounds,
  type TreeTransform,
  type Viewport,
  type layoutTree,
} from './treeLayout';

export function TreeCanvas({
  layout,
  viewport,
  transform,
  selected,
  collapsed,
  onSelect,
  onChange,
}: {
  layout: ReturnType<typeof layoutTree>;
  viewport: Viewport;
  transform: TreeTransform;
  selected?: string;
  collapsed: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onChange: (transform: TreeTransform) => void;
}) {
  const { theme } = useTheme();
  const bounds = viewBounds(viewport, transform);
  const visible = inView(layout.rows, bounds);
  const actualBounds = viewBounds(viewport, transform, 0);
  const { colors } = theme;
  const scale = transform.scale;

  return (
    <TreeGestureSurface
      {...viewport}
      surfaceColor={colors.subtle}
      transform={transform}
      onChange={onChange}
    >
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
        <Svg width={viewport.width} height={viewport.height} aria-hidden>
          <G
            transform={`translate(${transform.x} ${transform.y}) scale(${scale})`}
          >
            {layout.lines
              .filter((line) => overlaps(line.bounds, bounds))
              .map(({ connection, path, uncertain }) => (
                <Path
                  key={`${connection.category}-${connection.id}`}
                  d={path}
                  fill="none"
                  stroke={
                    connection.category === 'partnership'
                      ? colors.accent
                      : colors.inputBorder
                  }
                  strokeWidth={
                    connection.category === 'partnership' ? 2.6 : 1.8
                  }
                  strokeDasharray={
                    uncertain
                      ? '3 5'
                      : connection.category === 'other' ||
                          (connection.category === 'parent' &&
                            connection.kind === 'step')
                        ? '8 4'
                        : undefined
                  }
                  opacity={uncertain ? 0.65 : 1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
          </G>
        </Svg>
      </View>
      {visible.map(({ person, generation, x, y, width, height }) => {
        const active = selected === person.id;
        const fold = collapsed.has(person.id);
        const onScreen = overlaps(actualBounds, { x, y, width, height });
        return (
          <Link
            key={person.id}
            href={{
              pathname: '/family-tree/[personId]',
              params: { personId: person.id },
            }}
            asChild
            onPress={() => onSelect(person.id)}
          >
            <LinkPressable
              accessibilityRole="link"
              accessibilityLabel={`Open profile for ${person.name}, generation ${generation}`}
              accessibilityState={{ selected: active }}
              focusable={onScreen}
              tabIndex={onScreen ? 0 : -1}
              aria-hidden={!onScreen}
              accessibilityElementsHidden={!onScreen}
              importantForAccessibility={
                onScreen ? 'auto' : 'no-hide-descendants'
              }
              style={{
                position: 'absolute',
                left: x * scale + transform.x,
                top: y * scale + transform.y,
                width: width * scale,
                height: height * scale,
                backgroundColor: colors.surface,
                borderRadius: Math.max(4, 12 * scale),
                borderWidth: active ? 2 : 1,
                borderColor: active ? colors.primary : colors.inputBorder,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 8 * scale,
                overflow: 'hidden',
              }}
            >
              {scale >= 0.22 && (
                <Type
                  variant="label"
                  numberOfLines={2}
                  style={{
                    fontSize: Math.max(7, 15 * scale),
                    lineHeight: Math.max(9, 19 * scale),
                    textAlign: 'center',
                  }}
                >
                  {person.name}
                </Type>
              )}
              {scale >= 0.45 && (
                <Type
                  tone="muted"
                  numberOfLines={1}
                  style={{
                    fontSize: Math.max(7, 11 * scale),
                    lineHeight: Math.max(9, 15 * scale),
                    textAlign: 'center',
                  }}
                >
                  {fold
                    ? 'Branch collapsed'
                    : (person.subtitle ?? `Generation ${generation}`)}
                </Type>
              )}
            </LinkPressable>
          </Link>
        );
      })}
    </TreeGestureSurface>
  );
}
