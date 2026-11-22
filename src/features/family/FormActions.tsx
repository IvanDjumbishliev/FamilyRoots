import type { Href } from 'expo-router';
import { View } from 'react-native';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Type } from '@/components/Type';

export function FormActions({
  cancelTo,
  label,
  saving,
  error,
  onSubmit,
}: {
  cancelTo: Href;
  label: string;
  saving: boolean;
  error: boolean;
  onSubmit: () => void;
}) {
  return (
    <>
      {error && (
        <Type tone="danger" accessibilityRole="alert">
          Couldn’t save your changes. Try again.
        </Type>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button
          label={saving ? 'Saving…' : label}
          disabled={saving}
          onPress={onSubmit}
        />
        <ActionLink href={cancelTo} dismissTo label="Cancel" variant="quiet" />
      </View>
    </>
  );
}
