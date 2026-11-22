import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMockFamilyRepository } from '../../services/mockFamilyRepository';
import {
  groupGenerations,
  searchPeople,
  summarizeFamily,
} from './familySummary';

test('dashboard derives counts, newest relatives, and chronological milestones from records', () => {
  const repository = createMockFamilyRepository();
  const sample = repository.getSnapshot('sample');
  const summary = summarizeFamily(sample);
  assert.equal(summary.memberCount, sample.people.length);
  assert.equal(summary.generationCount, 4);
  assert.deepEqual(
    summary.recentPeople.map((person) => person.id),
    ['julien', 'claire', 'elena'],
  );
  assert.deepEqual(
    summary.timeline.map((event) => event.year),
    [1998, 1994, 1972, 1966],
  );
  assert.deepEqual(
    groupGenerations(sample.people).map(([generation]) => generation),
    [1, 2, 3, 4],
  );
  assert.equal(searchPeople(sample.people, ' moTHER ')[0]?.name, 'Rosa Moreau');
  assert.deepEqual(searchPeople(sample.people, ''), []);
});

test('mock mutations update dashboard and activity while preserving independent workspaces', async () => {
  const repository = createMockFamilyRepository(
    () => new Date('2030-01-01T12:00:00Z'),
  );
  const sample = repository.getSnapshot('sample');
  const empty = repository.getSnapshot('empty');
  assert.deepEqual(summarizeFamily(empty), {
    memberCount: 0,
    generationCount: 0,
    recentPeople: [],
    timeline: [],
    activity: [],
  });
  let notifications = 0;
  const unsubscribe = repository.subscribe(() => {
    notifications++;
  });

  await Promise.all([
    repository.addPerson('empty', {
      name: 'Taylor',
      generation: 4,
      birthYear: 1982,
    }),
    repository.addPerson('empty', { name: 'Morgan', generation: 4 }),
    repository.addMemory('empty', {
      name: 'Letter.pdf',
      mimeType: 'application/pdf',
      uri: 'file:///letter.pdf',
    }),
    repository.createBook('empty', 'Our family'),
  ]);
  unsubscribe();

  const updated = repository.getSnapshot('empty');
  const summary = summarizeFamily(updated);
  assert.equal(notifications, 4);
  assert.equal(repository.getSnapshot('sample'), sample);
  assert.equal(empty.people.length, 0);
  assert.equal(summary.memberCount, 2);
  assert.equal(summary.generationCount, 1);
  assert.deepEqual(
    summary.timeline.map((event) => event.label),
    ['Taylor was born'],
  );
  assert.equal(summary.activity.length, 4);
  assert.equal(updated.memories[0]?.name, 'Letter.pdf');
  assert.equal(updated.books[0]?.chapters.length, 3);
});
