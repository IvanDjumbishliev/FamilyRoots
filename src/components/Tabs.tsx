import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { Button } from '@/components/Button';

type Tab<T extends string> = { value: T; label: string; content: ReactNode };

export function Tabs<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly Tab<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const id = useId();
  const refs = useRef(new Map<T, View>());

  function handleKeyDown(event: KeyboardEvent, index: number) {
    const offset =
      event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (!offset && event.key !== 'Home' && event.key !== 'End') return;
    const target =
      items[
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : (index + offset + items.length) % items.length
      ];
    event.preventDefault();
    if (target) {
      onChange(target.value);
      refs.current.get(target.value)?.focus();
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <View
        accessibilityRole="tablist"
        accessibilityLabel={label}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}
      >
        {items.map((item, index) => {
          const selected = value === item.value;
          const webEvents =
            Platform.OS === 'web'
              ? {
                  onKeyDown: (event: KeyboardEvent) =>
                    handleKeyDown(event, index),
                }
              : {};
          return (
            <Button
              {...webEvents}
              key={item.value}
              ref={(control) => {
                if (control) refs.current.set(item.value, control);
                else refs.current.delete(item.value);
              }}
              nativeID={`${id}-${item.value}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              aria-selected={selected}
              aria-controls={`${id}-${item.value}-panel`}
              tabIndex={selected ? 0 : -1}
              label={item.label}
              variant="secondary"
              selected={selected}
              onPress={() => onChange(item.value)}
            />
          );
        })}
      </View>
      {items.map((item) => (
        <View
          key={item.value}
          nativeID={`${id}-${item.value}-panel`}
          role={Platform.OS === 'web' ? 'tabpanel' : undefined}
          aria-labelledby={`${id}-${item.value}`}
          tabIndex={
            Platform.OS === 'web' && item.value === value ? 0 : undefined
          }
          style={item.value === value ? undefined : { display: 'none' }}
        >
          {item.value === value && item.content}
        </View>
      ))}
    </View>
  );
}
