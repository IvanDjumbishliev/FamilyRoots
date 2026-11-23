import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';

type Option = { id: string; label: string };

export function ArchivePicker({
  label,
  options,
  selected,
  onToggle,
  multiple = false,
}: {
  label: string;
  options: readonly Option[];
  selected: readonly string[];
  onToggle: (id: string) => void;
  multiple?: boolean;
}) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase();
  const chosen = new Set(selected);
  const list = options.filter(
    (option) => query && option.label.toLocaleLowerCase().includes(query),
  );
  return (
    <View style={{ gap: 8 }}>
      <TextField label={label} value={search} onChangeText={setSearch} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options
          .filter(({ id }) => chosen.has(id))
          .map(({ id, label: value }) => (
            <Button
              key={id}
              label={`Remove ${value}`}
              variant="secondary"
              selected
              onPress={() => onToggle(id)}
            />
          ))}
        {list
          .filter(({ id }) => !chosen.has(id))
          .slice(0, 10)
          .map(({ id, label: value }) => (
            <Button
              key={id}
              label={`${multiple ? 'Link' : 'Select'} ${value}`}
              variant="quiet"
              onPress={() => onToggle(id)}
            />
          ))}
      </View>
      {query && !list.length && <Type tone="muted">No matching records.</Type>}
    </View>
  );
}
