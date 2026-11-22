import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Type } from '@/components/Type';

export function DialogContent({
  title,
  titleId,
  children,
  onClose,
}: PropsWithChildren<{
  title: string;
  titleId?: string;
  onClose: () => void;
}>) {
  return (
    <Card>
      <Type nativeID={titleId} variant="heading" accessibilityRole="header">
        {title}
      </Type>
      {children}
      <View style={{ alignItems: 'flex-end' }}>
        <Button label="Close" variant="secondary" onPress={onClose} />
      </View>
    </Card>
  );
}
