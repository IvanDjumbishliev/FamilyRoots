import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  eventDateLabel,
  filterTimeline,
  groupTimeline,
  parseYearFilter,
  timelineForBook,
  type TimelineEvent,
} from './timelineModel';

function event(
  id: string,
  date: string | null,
  options: Partial<TimelineEvent> = {},
): TimelineEvent {
  return {
    id,
    title: id,
    type: 'custom',
    kind: 'family',
    date,
    precision: date ? 'day' : 'unknown',
    approximate: false,
    verification: 'unverified',
    people: [],
    items: [],
    sources: [],
    ...options,
  };
}

test('sorts dated events in ascending order and groups undated events last', () => {
  const data = [
    event('Unknown', null),
    event('Later', '1981-02-01'),
    event('Earlier', '1910-01-01', { precision: 'year', approximate: true }),
    event('Middle', '1910-08-01', { precision: 'month' }),
  ];
  const groups = groupTimeline(data, 'decade');
  assert.deepEqual(
    groups.map(({ period, entries }) => [period, entries.map(({ id }) => id)]),
    [
      ['1910s', ['Earlier', 'Middle']],
      ['1980s', ['Later']],
      ['Date unknown', ['Unknown']],
    ],
  );
  assert.equal(eventDateLabel(data[2]), 'About 1910');
  assert.equal(eventDateLabel(data[3]), '1910-08');
  assert.equal(eventDateLabel(data[0]), 'Date unknown');
});

test('century boundaries are calendar centuries and context remains separate in book input', () => {
  const family = event('Archive evidence', '1900-10-01', {
    verification: 'verified',
    people: ['p1'],
    items: ['photo'],
    sources: ['register'],
  });
  const context = event('Context only', '1901-01-01', { kind: 'context' });
  const { family: events, historicalContext } = timelineForBook(
    [context, family],
    'century',
  );
  assert.deepEqual(
    events.map(({ period }) => period),
    ['1801–1900'],
  );
  assert.deepEqual(
    historicalContext.map(({ period }) => period),
    ['1901–2000'],
  );
  assert.deepEqual(events[0].entries[0].sources, ['register']);
  assert.deepEqual(events[0].entries[0].items, ['photo']);
  assert.equal(events[0].entries[0].verification, 'verified');
});

test('person, descendant branch, type and year range filters intersect', () => {
  const data = [
    event('Migration', '1950-01-01', {
      type: 'migration',
      people: ['child', 'partner'],
    }),
    event('Undated', null, { type: 'migration', people: ['child'] }),
    event('Occupation', '1951-01-05', {
      type: 'occupation',
      people: ['child'],
    }),
    event('Different branch', '1952-01-05', {
      type: 'migration',
      people: ['other'],
    }),
  ];
  assert.deepEqual(
    filterTimeline(data, {
      type: 'migration',
      person: 'child',
      branch: new Set(['root', 'child']),
      from: 1950,
      to: 1959,
      includeUndated: false,
    }).map((item) => item.id),
    ['Migration'],
  );
  assert.deepEqual(
    filterTimeline(data, {
      type: 'migration',
      person: 'child',
      includeUndated: true,
    }).map((item) => item.id),
    ['Migration', 'Undated'],
  );
  assert.deepEqual(parseYearFilter('1950', '1950'), { from: 1950, to: 1950 });
  assert.ok(parseYearFilter('1960', '1950').error);
  assert.ok(parseYearFilter('999', '').error);
});
