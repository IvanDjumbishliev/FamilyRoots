import { useState } from 'react';
import { z } from 'zod';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { ReviewProposal } from '@/features/collaboration/ReviewProposal';
import { useSave } from '@/features/family/useSave';
import { Choices } from '@/features/people/Choices';
import {
  livingOptions,
  personChanges,
  personDefaults,
  validatePerson,
  verificationOptions,
  type PersonChanges,
  type PersonFormValues,
} from '@/features/people/personForm';
import type { ConnectedPerson } from '@/services/peopleRepository';

type StringField = {
  [Key in keyof PersonFormValues]: PersonFormValues[Key] extends string
    ? Key
    : never;
}[keyof PersonFormValues];

export function PersonEditor({
  person,
  write,
  onSaved,
}: {
  person?: ConnectedPerson;
  write: (values: PersonChanges) => Promise<string>;
  onSaved: (id: string) => void;
}) {
  const [values, setValues] = useState(() => personDefaults(person));
  const [mode, setMode] = useState<'draft' | 'active'>();
  const request = useSave();
  const validation = mode && validatePerson(values, mode === 'draft');
  const errors =
    validation && !validation.success
      ? z.flattenError(validation.error).fieldErrors
      : {};

  function update<Key extends keyof PersonFormValues>(
    key: Key,
    value: PersonFormValues[Key],
  ) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  function text(
    key: StringField,
    label: string,
    maxLength: number,
    multiline = false,
    hint?: string,
  ) {
    return (
      <TextField
        label={label}
        value={values[key]}
        onChangeText={(value) => update(key, value)}
        maxLength={maxLength}
        multiline={multiline}
        error={errors[key]?.[0]}
        hint={hint}
      />
    );
  }

  function submit(draft: boolean) {
    setMode(draft ? 'draft' : 'active');
    const result = validatePerson(values, draft);
    if (!result.success) return;
    let savedId = '';
    void request.save(
      async () => {
        savedId = await write(personChanges(result.data, draft));
      },
      () => onSaved(savedId),
    );
  }

  return (
    <Screen>
      <PageHeading
        title={person ? 'Edit person' : 'Add Person'}
        description="Only share details you have permission to keep in this private tree. Optional fields can be left blank."
      />
      <Card>
        <Type variant="heading">Names and identity</Type>
        {text('givenNames', 'Given names', 160)}
        {text('surnames', 'Surnames', 160)}
        {text('birthName', 'Birth name', 160)}
        {text(
          'alternativeNames',
          'Alternative names',
          3220,
          true,
          'Enter one name per line.',
        )}
        {text('genderIdentity', 'Gender identity (optional)', 100)}
        <Choices
          label="Living status"
          choices={livingOptions}
          value={values.livingStatus}
          onChange={(value) => update('livingStatus', value)}
        />
        {errors.livingStatus?.[0] && (
          <Type tone="danger" accessibilityRole="alert">
            {errors.livingStatus[0]}
          </Type>
        )}
      </Card>
      <Card>
        <Type variant="heading">Birth and death</Type>
        {text(
          'birthDate',
          'Birth date',
          10,
          false,
          'Use YYYY, YYYY-MM, or YYYY-MM-DD. Leave blank if unknown.',
        )}
        <Button
          label="Approximate birth date"
          variant="secondary"
          disabled={!values.birthDate.trim()}
          selected={values.birthApproximate}
          accessibilityRole="checkbox"
          aria-checked={values.birthApproximate}
          accessibilityState={{ checked: values.birthApproximate }}
          onPress={() => update('birthApproximate', !values.birthApproximate)}
        />
        {text('birthPlace', 'Birth place', 240)}
        {text(
          'deathDate',
          'Death date',
          10,
          false,
          'Use YYYY, YYYY-MM, or YYYY-MM-DD. Leave blank if unknown.',
        )}
        <Button
          label="Approximate death date"
          variant="secondary"
          disabled={!values.deathDate.trim()}
          selected={values.deathApproximate}
          accessibilityRole="checkbox"
          aria-checked={values.deathApproximate}
          accessibilityState={{ checked: values.deathApproximate }}
          onPress={() => update('deathApproximate', !values.deathApproximate)}
        />
        {text('deathPlace', 'Death place', 240)}
      </Card>
      <Card>
        <Type variant="heading">Family history</Type>
        {text('biography', 'Biography', 10000, true)}
        {text('occupation', 'Occupation', 160)}
        {text('nationality', 'Nationality', 160)}
        {text('notes', 'Notes', 10000, true)}
        <Choices
          label="Verification status"
          choices={verificationOptions}
          value={values.verificationStatus}
          onChange={(value) => update('verificationStatus', value)}
        />
        {request.error && (
          <Type tone="danger" accessibilityRole="alert">
            Couldn’t save. Check your access or reopen the profile if someone
            else edited it.
          </Type>
        )}
        {request.error && person && (
          <ReviewProposal
            treeId={person.tree_id}
            target="people"
            id={person.id}
            draft={{
              biography: values.biography,
              notes: values.notes,
              nationality: values.nationality,
              occupation: values.occupation,
              birth_place: values.birthPlace,
              death_place: values.deathPlace,
            }}
          />
        )}
        <Button
          label={request.saving ? 'Saving…' : 'Save person'}
          disabled={request.saving}
          onPress={() => submit(false)}
        />
        {(!person || person.is_draft) && (
          <Button
            label="Save draft"
            variant="secondary"
            disabled={request.saving}
            onPress={() => submit(true)}
          />
        )}
        <ActionLink
          href={
            person
              ? {
                  pathname: '/family-tree/[personId]',
                  params: { personId: person.id },
                }
              : '/family-tree'
          }
          dismissTo
          label="Cancel"
          variant="quiet"
        />
      </Card>
    </Screen>
  );
}
