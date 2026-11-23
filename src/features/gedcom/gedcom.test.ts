import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { emptyDate } from './model';
import { parseGedcom } from './parse';
import { writeGedcom } from './write';

const sample = readFileSync('supabase/fixtures/gedcom-sample.ged', 'utf8');
const document = (body: string, version = '7.0') =>
  `0 HEAD\n1 GEDC\n2 VERS ${version}\n${body}\n0 TRLR`;

test('reads 5.5.1 UTF-8, partial dates, notes, evidence and adoption', () => {
  const { data, warnings, version } = parseGedcom(sample);
  assert.equal(version, '5.5.1');
  assert.equal(data.people[0].name, 'Ana Pérez');
  assert.equal(
    data.people[0].notes,
    'Transcribed from a fictional register.\nNames are illustrative.',
  );
  assert.deepEqual(data.people[0].birth, {
    date: '1890-01-01',
    precision: 'year',
    approximate: true,
  });
  assert.equal(data.people[0].status, 'deceased');
  assert.equal(data.parents[0].kind, 'adoptive');
  assert.equal(data.partners.length, 0);
  assert.equal(
    data.events.find((event) => event.type === 'residence')?.citations[0].page,
    'Page 23',
  );
  assert.ok(
    warnings.some((issue) => issue.original.includes('fictional-photo.jpg')),
  );
});

test('round-trips vitals, multiple participants, connections and citation details', () => {
  const { data } = parseGedcom(sample);
  data.people[0].name = 'Ana Pérez (record name)';
  data.people[0].biography = 'Biographical text.';
  data.people[0].notes += '\n0 @BOGUS@ INDI\n@I1@';
  data.events.push({
    title: 'Moved together',
    type: 'migration',
    people: ['@I1@', '@I2@'],
    when: emptyDate,
    notes: 'Both appear in the letter.',
    place: '',
    citations: [],
  });
  data.partners.push({
    a: '@I1@',
    b: '@I2@',
    status: 'former',
    kind: 'civil_union',
    start: { date: '1960-01-01', precision: 'year', approximate: false },
    end: emptyDate,
    notes: 'Recorded partnership',
    citations: [{ source: '@S1@', page: 'Page 12', notes: 'Second edition' }],
  });
  const result = parseGedcom(writeGedcom(data));
  assert.equal(result.version, '7.0');
  assert.deepEqual(result.warnings, []);
  const byTitle = (a: { title: string }, b: { title: string }) =>
    a.title.localeCompare(b.title);
  result.data.events.sort(byTitle);
  data.events.sort(byTitle);
  assert.deepEqual(result.data, data);
});

test('rejects invalid line structure, duplicate or dangling references, unsafe version and oversized input', () => {
  assert.throws(() => parseGedcom('0 TRLR'), /HEAD/);
  assert.throws(
    () => parseGedcom(document('0 @I1@ INDI\n3 NAME Ana')),
    /nesting/,
  );
  assert.throws(
    () => parseGedcom(document('0 @I1@ INDI\n0 @I1@ INDI')),
    /Duplicate/,
  );
  assert.throws(
    () => parseGedcom(document('0 @F1@ FAM\n1 HUSB @I1@')),
    /missing or incompatible/,
  );
  assert.throws(
    () => parseGedcom(document('0 @I1@ INDI', '5.5')),
    /Supported versions/,
  );
  assert.throws(() => parseGedcom('x'.repeat(1024 * 1024 + 1)), /1 MiB/);
});

test('reports impossible and uncertain dates, unrecognized tags and unsafe URLs', () => {
  const { data, warnings } = parseGedcom(
    document(
      '0 @I1@ INDI\n1 NAME Ana\n1 BIRT\n2 DATE 31 FEB 2000\n1 RESI\n2 DATE BEF 1990\n1 _SECRET Hidden\n0 @S1@ SOUR\n1 TITL Test\n1 _FR_URL javascript:alert(1)',
    ),
  );
  assert.equal(data.people[0].birth.date, null);
  assert.equal(data.sources[0].url, '');
  for (const expected of ['31 FEB', 'BEF 1990', '_SECRET', 'javascript:'])
    assert.ok(warnings.some((issue) => issue.original.includes(expected)));
});

test('keeps a single named adoptive parent distinct from the other family adult', () => {
  const { data } = parseGedcom(
    document(
      '0 @I1@ INDI\n1 NAME Pat\n0 @I2@ INDI\n1 NAME Robin\n0 @I3@ INDI\n1 NAME Luz\n1 ADOP\n2 FAMC @F1@\n3 ADOP WIFE\n0 @F1@ FAM\n1 HUSB @I1@\n1 WIFE @I2@\n1 CHIL @I3@',
    ),
  );
  assert.deepEqual(
    data.parents.map(({ parent, kind }) => [parent, kind]),
    [
      ['@I1@', 'other'],
      ['@I2@', 'adoptive'],
    ],
  );
});

test('supports anonymous GEDCOM 7 records and reports null references and challenged links', () => {
  const { data, warnings } = parseGedcom(
    document(
      '0 INDI\n1 NAME Anonymous\n1 SOUR @VOID@\n2 PAGE Oral tradition\n0 @I1@ INDI\n1 NAME Pat\n0 @I2@ INDI\n1 NAME Robin\n1 FAMC @F1@\n2 STAT DISPROVEN\n0 @F1@ FAM\n1 HUSB @I1@\n1 WIFE @VOID@\n1 CHIL @I2@',
    ),
  );
  assert.equal(data.people.length, 3);
  assert.equal(data.parents.length, 0);
  assert.ok(warnings.some((warning) => warning.original.includes('DISPROVEN')));
  assert.ok(
    warnings.some((warning) => warning.original.includes('Oral tradition')),
  );
});
