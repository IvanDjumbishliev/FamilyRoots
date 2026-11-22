import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Type } from '@/components/Type';
import { useTheme } from '@/hooks/useTheme';
import type { Person } from '@/types/family';

export function PersonList({ people }: { people: readonly Person[] }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      {people.map((person) => (
        <View
          key={person.id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: theme.colors.subtle,
            }}
          >
            <Icon name="person" size={19} color={theme.colors.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Type variant="label">{person.name}</Type>
            <Type variant="detail" tone="muted">
              {[person.relation, person.birthYear && `Born ${person.birthYear}`]
                .filter(Boolean)
                .join(' · ') || `Generation ${person.generation}`}
            </Type>
          </View>
        </View>
      ))}
    </View>
  );
}
