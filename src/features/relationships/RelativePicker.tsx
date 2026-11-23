import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import type { RelationshipData } from '@/services/relationshipRepository';

type Relative = RelationshipData['people'][number];

export function RelativePicker({
  people,
  selected,
  onSelect,
  label,
}: {
  people: readonly Relative[];
  selected?: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  const [query, setQuery] = useState('');
  const current = people.find((person) => person.id === selected);
  const term = query.trim().toLocaleLowerCase();
  const matches = people.filter(
    (person) =>
      !term ||
      [
        person.display_name,
        person.birth_name,
        ...person.alternative_names,
      ].some((name) => name?.toLocaleLowerCase().includes(term)),
  );

  return (
    <View style={{ gap: 8 }}>
      <TextField label={label} value={query} onChangeText={setQuery} />
      {current && (
        <Type variant="label">Selected · {current.display_name}</Type>
      )}
      {matches.slice(0, 8).map((person) => (
        <Button
          key={person.id}
          label={person.display_name}
          variant="secondary"
          selected={selected === person.id}
          aria-pressed={selected === person.id}
          onPress={() => onSelect(person.id)}
        />
      ))}
      {!matches.length && <Type tone="muted">No matching people.</Type>}
      {matches.length > 8 && (
        <Type tone="muted">Search by name to narrow the results.</Type>
      )}
    </View>
  );
}
