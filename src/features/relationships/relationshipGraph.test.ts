import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildFamilyGraph,
  connectionLabel,
  possibleDuplicateName,
  type Connection,
  type ParentLink,
} from './relationshipGraph';

const evidence = {
  provenance: 'documented',
  verification: 'verified',
  notes: null,
} as const;
const parent = (
  id: string,
  parent: string,
  child: string,
  kind: ParentLink['kind'] = 'biological',
): ParentLink => ({
  ...evidence,
  id,
  category: 'parent',
  parent,
  child,
  kind,
});

test('derives generations, shared-parent siblings and grandparents for biological and adoptive lines', () => {
  const graph = buildFamilyGraph(
    ['grand', 'parent', 'adoptive', 'child', 'half', 'step', 'unlinked'],
    [
      parent('1', 'grand', 'parent'),
      parent('2', 'parent', 'child'),
      parent('3', 'adoptive', 'child', 'adoptive'),
      parent('4', 'parent', 'half'),
      parent('5', 'parent', 'step', 'step'),
      parent('6', 'parent', 'child', 'adoptive'),
    ],
  );
  assert.deepEqual(graph.siblings('child'), ['half']);
  assert.deepEqual(graph.grandparents('child'), ['grand']);
  assert.deepEqual(graph.grandchildren('grand'), ['child', 'half']);
  assert.equal(graph.generations.get('child'), 3);
  assert.equal(graph.generations.get('unlinked'), 1);
  assert.deepEqual(graph.ancestry('child'), [
    { id: 'adoptive', depth: 1, via: 'child' },
    { id: 'parent', depth: 1, via: 'child' },
    { id: 'grand', depth: 2, via: 'parent' },
  ]);
});

test('finds shortest paths through former and multiple partnerships and step connections', () => {
  const previous: Connection = {
    ...evidence,
    id: 'former',
    category: 'partnership',
    a: 'parent',
    b: 'former',
    kind: 'marriage',
    status: 'former',
    startedOn: '1950-01-01',
    startPrecision: 'year',
    startApproximate: true,
    endedOn: null,
    endPrecision: 'unknown',
    endApproximate: false,
  };
  const graph = buildFamilyGraph(
    ['child', 'parent', 'former', 'current', 'step', 'unrelated'],
    [
      parent('1', 'parent', 'child'),
      previous,
      { ...previous, id: 'current', b: 'current', status: 'current' },
      parent('2', 'former', 'step', 'step'),
    ],
  );
  const path = graph.relationshipPath('child', 'step');
  assert.deepEqual(
    path?.map((edge) => connectionLabel(edge.connection, edge.from)),
    ['Biological parent', 'Former spouse', 'Stepchild'],
  );
  assert.equal(graph.relationshipPath('child', 'current')?.length, 2);
  assert.deepEqual(graph.relationshipPath('child', 'child'), []);
  assert.equal(graph.relationshipPath('child', 'unrelated'), undefined);
});

test('excludes disputed or AI-suggested edges, and tolerates legacy cyclic data', () => {
  const graph = buildFamilyGraph(
    ['a', 'b', 'c', 'd'],
    [
      parent('1', 'a', 'b'),
      parent('2', 'b', 'a'),
      {
        ...parent('3', 'b', 'c'),
        provenance: 'ai_suggested',
        verification: 'unverified',
      },
      { ...parent('4', 'c', 'd'), verification: 'disputed' },
    ],
  );
  assert.deepEqual(graph.unresolvedGenerations, ['a', 'b']);
  assert.equal(graph.relationshipPath('a', 'c'), undefined);
  assert.equal(graph.relationshipPath('c', 'd'), undefined);
  assert.deepEqual(
    graph.ancestry('a').map((ancestor) => ancestor.id),
    ['b'],
  );
});

test('warns about equal normalized whole names but does not assume relatives from surnames', () => {
  assert.equal(
    possibleDuplicateName('Moreau, Élodie', ['Elodie Moreau']),
    true,
  );
  assert.equal(possibleDuplicateName('Ari Moreau', ['Elodie Moreau']), false);
  assert.equal(possibleDuplicateName(' ', ['']), false);
});
