import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createHistoricalSearch,
  ProviderError,
  searchForm,
  type GenealogyProvider,
  type HistoricalRecord,
} from './historicalSearch';

const filters = {
  name: 'Valette',
  place: '',
  from: '',
  to: '',
  type: 'all',
} as const;
const record: HistoricalRecord = {
  provider: 'one',
  id: 'A1',
  name: 'Ada Valette',
  title: 'Birth entry for Ada Valette',
  place: 'Montréal, Canada',
  year: 1872,
  type: 'birth',
  collection: 'Fictional civic registers',
  locator: 'Page 1',
  license: 'CC0-1.0',
  url: 'https://familyroots.example/record',
  retrievedAt: '2026-11-24T12:00:00+00:00',
  fictional: true,
};
function provider(
  id: string,
  search: GenealogyProvider['search'],
): GenealogyProvider {
  return { id, name: id, terms: { cache: 'none', allowSaving: true }, search };
}

test('validates and normalizes historical search fields', () => {
  assert.deepEqual(searchForm.parse({ ...filters, name: ' Valette ' }), {
    name: 'Valette',
    place: '',
    from: 1600,
    to: 1925,
    type: 'all',
  });
  for (const invalid of [
    { name: '' },
    { from: '189' },
    { to: '2025' },
    { from: '1910', to: '1890' },
  ])
    assert.equal(
      searchForm.safeParse({ ...filters, ...invalid }).success,
      false,
    );
});

test('deduplicates overlapping entries and retains every provider attribution', async () => {
  const search = createHistoricalSearch([
    provider('one', async () => [
      record,
      record,
      { ...record, id: 'A2', locator: 'Page 2' },
    ]),
    provider('two', async () => [
      { ...record, provider: 'two', id: 'B1', place: 'Montreal, Canada' },
    ]),
  ]);
  const { hits, errors } = await search(searchForm.parse(filters));
  assert.equal(hits.length, 2);
  assert.deepEqual(
    hits[0].attributions.map((source) => source.provider),
    ['one', 'two'],
  );
  assert.deepEqual(errors, []);
});

test('preserves working provider results when another is limited or misattributes records', async () => {
  const search = createHistoricalSearch([
    provider('one', async () => [record]),
    provider('two', async () => {
      throw new ProviderError('Retry later.');
    }),
    provider('three', async () => [record]),
  ]);
  const { hits, errors } = await search(searchForm.parse(filters));
  assert.equal(hits.length, 1);
  assert.deepEqual(
    errors.map((error) => error.message),
    ['Retry later.', 'Unexpected provider attribution.'],
  );
});
