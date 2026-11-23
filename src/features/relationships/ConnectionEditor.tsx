import { useState } from 'react';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { useSave } from '@/features/family/useSave';
import { Choices } from '@/features/people/Choices';
import {
  formatHistoricalDate,
  parseHistoricalDate,
} from '@/features/people/personForm';
import {
  endpoints,
  parentKinds,
  partnerKinds,
  partnerStatuses,
  possibleDuplicateName,
  type Connection,
  type ParentKind,
  type PartnerKind,
  type PartnerStatus,
} from '@/features/relationships/relationshipGraph';
import { RelativePicker } from '@/features/relationships/RelativePicker';
import {
  connectionError,
  type RelationshipData,
} from '@/services/relationshipRepository';
import type { Json } from '@/types/database';

const categories = [
  { value: 'parent', label: 'Parent or child' },
  { value: 'partnership', label: 'Spouse or partner' },
  { value: 'other', label: 'Other connection' },
] as const;
const directions = [
  { value: 'parent', label: 'They are the parent' },
  { value: 'child', label: 'They are the child' },
] as const;
const selection = [
  { value: 'existing', label: 'Existing person' },
  { value: 'new', label: 'New person' },
] as const;
const provenanceOptions = [
  { value: 'user_reported', label: 'Family account' },
  { value: 'documented', label: 'Documented' },
] as const;

export function ConnectionEditor({
  personId,
  people,
  connection,
  save,
  onSaved,
}: {
  personId: string;
  people: RelationshipData['people'];
  connection?: Connection;
  save: (values: Json) => Promise<void>;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState<Connection['category']>(
    connection?.category ?? 'parent',
  );
  const [targetId, setTargetId] = useState(
    connection && endpoints(connection).find((id) => id !== personId),
  );
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<'parent' | 'child'>(
    connection?.category === 'parent' && connection.parent === personId
      ? 'child'
      : 'parent',
  );
  const [parentKind, setParentKind] = useState<ParentKind>(
    connection?.category === 'parent' ? connection.kind : 'biological',
  );
  const [partnerKind, setPartnerKind] = useState<PartnerKind>(
    connection?.category === 'partnership' ? connection.kind : 'marriage',
  );
  const [status, setStatus] = useState<PartnerStatus>(
    connection?.category === 'partnership' ? connection.status : 'unknown',
  );
  const [label, setLabel] = useState(
    connection?.category === 'other' ? connection.label : '',
  );
  const [start, setStart] = useState(
    connection?.category === 'partnership'
      ? formatHistoricalDate(connection.startedOn, connection.startPrecision)
      : '',
  );
  const [end, setEnd] = useState(
    connection?.category === 'partnership'
      ? formatHistoricalDate(connection.endedOn, connection.endPrecision)
      : '',
  );
  const [startApproximate, setStartApproximate] = useState(
    connection?.category === 'partnership' && connection.startApproximate,
  );
  const [endApproximate, setEndApproximate] = useState(
    connection?.category === 'partnership' && connection.endApproximate,
  );
  const [notes, setNotes] = useState(connection?.notes ?? '');
  const [provenance, setProvenance] = useState<'user_reported' | 'documented'>(
    'user_reported',
  );
  const [acceptedDuplicate, setAcceptedDuplicate] = useState(false);
  const [feedback, setFeedback] = useState('');
  const request = useSave();
  const existingPeople = people.filter(
    (person) => person.id !== personId && !person.archived_at,
  );
  const duplicate =
    mode === 'new' &&
    possibleDuplicateName(
      name,
      people.flatMap((person) => [
        person.display_name,
        person.birth_name ?? '',
        ...person.alternative_names,
      ]),
    );

  function submit() {
    setFeedback('');
    if (!connection && mode === 'existing' && !targetId)
      return setFeedback('Select the person to connect.');
    if (mode === 'new' && !name.trim())
      return setFeedback('Enter a name for the new person.');
    if (duplicate && !acceptedDuplicate)
      return setFeedback(
        'Choose the existing person or confirm this is a different person.',
      );
    if (category === 'other' && !label.trim())
      return setFeedback('Enter the documented relationship type.');
    const startDate =
      category === 'partnership' ? parseHistoricalDate(start) : undefined;
    const endDate =
      category === 'partnership' ? parseHistoricalDate(end) : undefined;
    if (category === 'partnership' && (!startDate || !endDate))
      return setFeedback('Use YYYY, YYYY-MM, or YYYY-MM-DD for dates.');
    if (category === 'partnership' && status === 'current' && endDate?.date)
      return setFeedback('A current partnership cannot have an end date.');
    if (
      startDate?.date &&
      endDate?.date &&
      !startApproximate &&
      !endApproximate
    ) {
      const last = new Date(`${endDate.date}T00:00:00Z`);
      if (endDate.precision === 'year') last.setUTCMonth(11, 31);
      if (endDate.precision === 'month')
        last.setUTCMonth(last.getUTCMonth() + 1, 0);
      if (startDate.date > last.toISOString().slice(0, 10))
        return setFeedback('An end date cannot precede the start date.');
    }
    const kind =
      category === 'parent'
        ? parentKind
        : category === 'partnership'
          ? partnerKind
          : label.trim();
    void request.save(async () => {
      try {
        await save({
          id: connection?.id,
          category,
          kind,
          direction,
          provenance,
          status,
          notes,
          targetId: mode === 'existing' ? targetId : undefined,
          newName: mode === 'new' ? name.trim() : undefined,
          startedOn: startDate?.date,
          startPrecision: startDate?.precision,
          startApproximate: Boolean(startDate?.date && startApproximate),
          endedOn: endDate?.date,
          endPrecision: endDate?.precision,
          endApproximate: Boolean(endDate?.date && endApproximate),
        });
      } catch (error) {
        setFeedback(connectionError(error));
        throw error;
      }
    }, onSaved);
  }

  return (
    <>
      {connection ? (
        <Type variant="label">
          {people.find((person) => person.id === targetId)?.display_name}
        </Type>
      ) : (
        <>
          <Choices
            label="Connect to"
            choices={selection}
            value={mode}
            onChange={setMode}
          />
          {mode === 'existing' ? (
            <RelativePicker
              people={existingPeople}
              selected={targetId}
              onSelect={setTargetId}
              label="Search people"
            />
          ) : (
            <>
              <TextField
                label="New person’s name"
                value={name}
                maxLength={160}
                onChangeText={(value) => {
                  setName(value);
                  setAcceptedDuplicate(false);
                }}
              />
              {duplicate && (
                <>
                  <Type tone="danger" accessibilityRole="alert">
                    A person with this name or an alternative name already
                    exists in this tree.
                  </Type>
                  <Button
                    label="This is a different person"
                    variant="secondary"
                    accessibilityRole="checkbox"
                    aria-checked={acceptedDuplicate}
                    accessibilityState={{ checked: acceptedDuplicate }}
                    selected={acceptedDuplicate}
                    onPress={() => setAcceptedDuplicate(!acceptedDuplicate)}
                  />
                </>
              )}
            </>
          )}
          <Choices
            label="Relationship category"
            choices={categories}
            value={category}
            onChange={setCategory}
          />
        </>
      )}
      {category === 'parent' && (
        <>
          <Choices
            label="Direction"
            choices={directions}
            value={direction}
            onChange={setDirection}
          />
          <Choices
            label="Parent-child type"
            choices={parentKinds}
            value={parentKind}
            onChange={setParentKind}
          />
        </>
      )}
      {category === 'partnership' && (
        <>
          <Choices
            label="Partnership type"
            choices={partnerKinds}
            value={partnerKind}
            onChange={setPartnerKind}
          />
          <Choices
            label="Partnership status"
            choices={partnerStatuses}
            value={status}
            onChange={setStatus}
          />
          <TextField
            label="Start date"
            value={start}
            maxLength={10}
            onChangeText={setStart}
            hint="YYYY, YYYY-MM, or YYYY-MM-DD. Leave blank if unknown."
          />
          <Button
            label="Approximate start date"
            variant="secondary"
            accessibilityRole="checkbox"
            aria-checked={startApproximate}
            accessibilityState={{ checked: startApproximate }}
            selected={startApproximate}
            disabled={!start.trim()}
            onPress={() => setStartApproximate(!startApproximate)}
          />
          <TextField
            label="End date"
            value={end}
            maxLength={10}
            onChangeText={setEnd}
            hint="Leave blank if unknown or still current."
          />
          <Button
            label="Approximate end date"
            variant="secondary"
            accessibilityRole="checkbox"
            aria-checked={endApproximate}
            accessibilityState={{ checked: endApproximate }}
            selected={endApproximate}
            disabled={!end.trim()}
            onPress={() => setEndApproximate(!endApproximate)}
          />
        </>
      )}
      {category === 'other' && (
        <TextField
          label="Documented relationship type"
          value={label}
          maxLength={80}
          onChangeText={setLabel}
          placeholder="For example, godparent connection"
        />
      )}
      {!connection && (
        <Choices
          label="Provenance"
          choices={provenanceOptions}
          value={provenance}
          onChange={setProvenance}
        />
      )}
      <TextField
        label="Relationship notes (optional)"
        value={notes}
        maxLength={2000}
        onChangeText={setNotes}
        multiline
      />
      {feedback && (
        <Type tone="danger" accessibilityRole="alert">
          {feedback}
        </Type>
      )}
      <Button
        label={request.saving ? 'Saving…' : 'Save relationship'}
        disabled={request.saving}
        onPress={submit}
      />
    </>
  );
}
