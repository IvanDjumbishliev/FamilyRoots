import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Type } from '@/components/Type';

export function Choices<T extends string>({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Type variant="label">{label}</Type>
      <View
        role="group"
        aria-label={label}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
      >
        {choices.map((choice) => (
          <Button
            key={choice.value}
            label={choice.label}
            variant="secondary"
            selected={value === choice.value}
            accessibilityState={{ selected: value === choice.value }}
            aria-pressed={value === choice.value}
            onPress={() => onChange(choice.value)}
          />
        ))}
      </View>
    </View>
  );
}
