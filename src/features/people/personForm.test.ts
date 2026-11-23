import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatHistoricalDate,
  parseHistoricalDate,
  personChanges,
  personDefaults,
  validatePerson,
} from './personForm';

test('partial, uncertain, and invalid dates stay distinct', () => {
  assert.deepEqual(parseHistoricalDate(''), {
    date: null,
    precision: 'unknown',
  });
  assert.deepEqual(parseHistoricalDate('1901'), {
    date: '1901-01-01',
    precision: 'year',
  });
  assert.deepEqual(parseHistoricalDate('2000-02'), {
    date: '2000-02-01',
    precision: 'month',
  });
  assert.equal(parseHistoricalDate('1900-02-29'), undefined);
  assert.deepEqual(parseHistoricalDate('2000-02-29'), {
    date: '2000-02-29',
    precision: 'day',
  });
  assert.equal(formatHistoricalDate('1901-01-01', 'month'), '1901-01');
});

test('drafts may omit names and active records validate names and life dates', () => {
  const empty = personDefaults();
  const draft = validatePerson(empty, true);
  assert.ok(draft.success);
  assert.equal(personChanges(draft.data, true).display_name, 'Unnamed draft');
  assert.equal(validatePerson(empty, false).success, false);
  const person = {
    ...empty,
    givenNames: 'Ari',
    birthDate: '1910-02-14',
    deathDate: '1910-02',
  };
  assert.equal(validatePerson(person, false).success, true);
  assert.equal(
    validatePerson({ ...person, livingStatus: 'living' }, false).success,
    false,
  );
  assert.equal(
    validatePerson({ ...person, birthDate: '1910-03' }, false).success,
    false,
  );
  const approximate = validatePerson(
    { ...person, deathApproximate: true },
    false,
  );
  assert.ok(approximate.success);
  assert.equal(
    personChanges(approximate.data, false).death_date_approximate,
    true,
  );
});
