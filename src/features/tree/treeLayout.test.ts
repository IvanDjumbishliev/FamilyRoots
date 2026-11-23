import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Connection } from '../relationships/relationshipGraph';
import {
  centerOn,
  indexTree,
  inView,
  layoutTree,
  overlaps,
  viewBounds,
  visiblePeople,
  zoomAt,
  type TreePerson,
} from './treeLayout';

const people = (...ids: string[]): TreePerson[] =>
  ids.map((id) => ({ id, name: id, aliases: [] }));
const edge = (
  parent: string,
  child: string,
  kind: 'biological' | 'adoptive' | 'step' = 'biological',
): Connection => ({
  id: parent + child + kind,
  category: 'parent',
  parent,
  child,
  kind,
  verification: 'verified',
  provenance: 'documented',
  notes: null,
});
const partner = (a: string, b: string): Connection => ({
  id: a + b,
  category: 'partnership',
  a,
  b,
  kind: 'marriage',
  status: 'former',
  verification: 'unverified',
  provenance: 'user_reported',
  notes: null,
  startedOn: null,
  endedOn: null,
  startPrecision: 'unknown',
  endPrecision: 'unknown',
  startApproximate: false,
  endApproximate: false,
});

test('shared branches stay visible through another parent and scopes follow the selected person', () => {
  const graph = indexTree(people('A', 'B', 'C', 'D', 'E', 'F'), [
    edge('A', 'B'),
    edge('A', 'C', 'adoptive'),
    edge('C', 'D'),
    edge('B', 'D', 'step'),
    edge('F', 'C'),
    partner('B', 'C'),
  ]);
  assert.deepEqual(
    [...visiblePeople(graph, 'ancestors', 'D', new Set())].sort(),
    ['A', 'B', 'C', 'D', 'F'],
  );
  assert.deepEqual(
    [...visiblePeople(graph, 'descendants', 'B', new Set())].sort(),
    ['B', 'D'],
  );
  assert.deepEqual(
    [...visiblePeople(graph, 'full', undefined, new Set(['B']))].sort(),
    ['A', 'B', 'C', 'D', 'E', 'F'],
  );
  assert.deepEqual(
    [...visiblePeople(graph, 'full', undefined, new Set(['B', 'C']))].sort(),
    ['A', 'B', 'C', 'E', 'F'],
  );
});

test('placement of more than 100 people has separate cards and culls offscreen nodes', () => {
  const ids = Array.from({ length: 128 }, (_, index) => String(index));
  const graph = indexTree(
    people(...ids),
    ids.slice(1).map((id, index) => edge(String(Math.floor(index / 3)), id)),
  );
  const layout = layoutTree(graph, new Set(ids));
  const positions = [...layout.positions.values()];
  assert.equal(positions.length, 128);
  assert.equal(layout.lines.length, 127);
  assert.ok(
    positions.every((a, index) =>
      positions.slice(index + 1).every((b) => !overlaps(a, b)),
    ),
  );
  const visible = inView(
    layout.rows,
    viewBounds({ width: 390, height: 440 }, { x: 0, y: 0, scale: 1 }),
  );
  assert.ok(visible.length < positions.length / 2);
});

test('gutter routing avoids cards when a parent link spans several rows', () => {
  const graph = indexTree(people('A', 'B', 'C', 'D', 'E'), [
    edge('A', 'B'),
    edge('B', 'C'),
    edge('C', 'D'),
    edge('A', 'D'),
    partner('A', 'E'),
  ]);
  const layout = layoutTree(graph, new Set(graph.byId.keys()));
  for (const { path, connection } of layout.lines) {
    const points = [...path.matchAll(/[ML](-?\d+),(-?\d+)/g)].map((match) => [
      Number(match[1]),
      Number(match[2]),
    ]);
    const endpoints =
      connection.category === 'parent'
        ? [connection.parent, connection.child]
        : [connection.a, connection.b];
    for (let index = 1; index < points.length; index++) {
      const [x1, y1] = points[index - 1];
      const [x2, y2] = points[index];
      for (const node of layout.positions.values()) {
        if (endpoints.includes(node.person.id)) continue;
        assert.equal(
          overlaps(
            {
              x: Math.min(x1, x2),
              y: Math.min(y1, y2),
              width: Math.abs(x1 - x2),
              height: Math.abs(y1 - y2),
            },
            {
              x: node.x + 1,
              y: node.y + 1,
              width: node.width - 2,
              height: node.height - 2,
            },
          ),
          false,
        );
      }
    }
  }
});

test('zoom preserves the world point beneath the pointer and centering is exact', () => {
  const initial = { x: -80, y: 65, scale: 0.8 };
  const anchor = { x: 150, y: 120 };
  const next = zoomAt(initial, 1.25, anchor);
  assert.equal(next.scale, 1);
  assert.equal(
    (anchor.x - next.x) / next.scale,
    (anchor.x - initial.x) / initial.scale,
  );
  assert.equal(
    (anchor.y - next.y) / next.scale,
    (anchor.y - initial.y) / initial.scale,
  );
  assert.deepEqual(
    centerOn(next, { width: 400, height: 300 }, { x: 600, y: 500 }),
    { x: -400, y: -350, scale: 1 },
  );
});

test('legacy cycles and suggested links stay renderable without becoming traversal edges', () => {
  const dangling: Connection = {
    ...edge('A', 'C'),
    provenance: 'ai_suggested',
    verification: 'unverified',
  };
  const graph = indexTree(people('A', 'B', 'C'), [
    edge('A', 'B'),
    edge('B', 'A'),
    dangling,
  ]);
  const layout = layoutTree(
    graph,
    visiblePeople(graph, 'full', undefined, new Set()),
  );
  assert.equal(layout.positions.size, 3);
  assert.equal(layout.lines.length, 3);
  assert.equal(layout.lines.filter((line) => line.uncertain).length, 1);
  assert.deepEqual(
    [...visiblePeople(graph, 'descendants', 'A', new Set())],
    ['A', 'B'],
  );
});
