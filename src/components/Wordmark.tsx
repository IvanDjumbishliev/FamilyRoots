import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/hooks/useTheme';

export function Wordmark() {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.mark, { backgroundColor: theme.brand.forest }]}>
        <Icon name="tree" size={24} color={theme.brand.gold} />
      </View>
      <Text style={[styles.name, { color: theme.colors.text }]}>
        FamilyRoots <Text style={{ color: theme.colors.accent }}>AI</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
});
