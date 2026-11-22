import { View } from 'react-native';

import { Type } from '@/components/Type';

export function PageHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Type variant="title" accessibilityRole="header" aria-level={1}>
        {title}
      </Type>
      {description && <Type tone="muted">{description}</Type>}
    </View>
  );
}
