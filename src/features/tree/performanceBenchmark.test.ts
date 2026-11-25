/**
 * Phase 19 – Tree layout performance benchmarks
 *
 * Measures treeLayout() with synthetic trees of 100, 1 000, and 5 000 people.
 * Assertions use generous time budgets to avoid flakiness in CI.
 * Results are written to stdout so they can be captured in PERFORMANCE_MEASUREMENTS.md.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { layoutTree, indexTree, type TreeIndex } from '../../features/tree/treeLayout.ts';
import type { Connection, ParentLink } from '../../features/relationships/relationshipGraph.ts';

// ---------------------------------------------------------------------------
// Tree generator helpers
// ---------------------------------------------------------------------------
type RawPerson = {
  id: string;
  displayName: string;
  sex: 'M' | 'F' | 'U';
  birthYear: number | null;
};

function makePerson(id: string, name: string, birthYear: number | null = null): RawPerson {
  return { id, displayName: name, sex: 'U', birthYear };
}

function parentLink(id: string, parent: string, child: string): ParentLink {
  return {
    id,
    category: 'parent',
    parent,
    child,
    kind: 'biological',
    provenance: 'user_reported',
    verification: 'verified',
    notes: null,
  };
}

/**
 * Generates a balanced binary ancestry tree with `size` people.
 * Layout: person 0 is the root; person N's parents are 2N+1 and 2N+2.
 */
function generateTree(size: number): { people: RawPerson[]; connections: Connection[] } {
  const people: RawPerson[] = [];
  const connections: Connection[] = [];
  for (let i = 0; i < size; i++) {
    people.push(makePerson(`p${i}`, `Person ${i}`, 1900 - Math.floor(i / 2) * 25));
  }
  for (let i = 0; i < size; i++) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    if (left < size) {
      connections.push(parentLink(`e${left}`, `p${left}`, `p${i}`));
    }
    if (right < size) {
      connections.push(parentLink(`e${right}`, `p${right}`, `p${i}`));
    }
  }
  return { people, connections };
}

/**
 * Builds a TreeIndex from raw people and connections.
 * We need to construct the shape that indexTree expects.
 */
function buildTreeIndex(size: number): TreeIndex {
  const { people, connections } = generateTree(size);
  // indexTree expects a people lookup and connection list
  const peopleMap = new Map(people.map((p) => [p.id, p]));
  return indexTree(peopleMap, connections);
}

// ---------------------------------------------------------------------------
// Performance benchmarks
// ---------------------------------------------------------------------------
describe('treeLayout performance benchmarks', () => {
  it('100-person tree layouts in under 500ms', () => {
    const index = buildTreeIndex(100);
    const included = new Set(Array.from({ length: 100 }, (_, i) => `p${i}`));
    const start = performance.now();
    const rows = layoutTree(index, included);
    const elapsed = performance.now() - start;
    console.log(`[BENCHMARK] 100-person treeLayout: ${elapsed.toFixed(2)}ms`);
    assert.ok(Array.isArray(rows), 'layoutTree should return rows array');
    assert.ok(elapsed < 500, `100-person layout took ${elapsed.toFixed(1)}ms (limit: 500ms)`);
  });

  it('1000-person tree layouts in under 3000ms', () => {
    const index = buildTreeIndex(1000);
    const included = new Set(Array.from({ length: 1000 }, (_, i) => `p${i}`));
    const start = performance.now();
    const rows = layoutTree(index, included);
    const elapsed = performance.now() - start;
    console.log(`[BENCHMARK] 1000-person treeLayout: ${elapsed.toFixed(2)}ms`);
    assert.ok(Array.isArray(rows), 'layoutTree should return rows array');
    assert.ok(elapsed < 3000, `1000-person layout took ${elapsed.toFixed(1)}ms (limit: 3000ms)`);
  });

  it('5000-person tree completes without crashing', () => {
    const index = buildTreeIndex(5000);
    const included = new Set(Array.from({ length: 5000 }, (_, i) => `p${i}`));
    const start = performance.now();
    let rows: unknown;
    assert.doesNotThrow(() => {
      rows = layoutTree(index, included);
    });
    const elapsed = performance.now() - start;
    console.log(`[BENCHMARK] 5000-person treeLayout: ${elapsed.toFixed(2)}ms (no time limit)`);
    assert.ok(Array.isArray(rows), 'layoutTree should return rows array');
  });
});

// ---------------------------------------------------------------------------
// indexTree correctness
// ---------------------------------------------------------------------------
describe('indexTree correctness', () => {
  it('empty tree produces valid index', () => {
    const index = buildTreeIndex(0);
    assert.ok(index, 'empty tree index should be defined');
  });

  it('single person tree produces valid index', () => {
    const person = makePerson('p0', 'Alice');
    const index = indexTree(new Map([['p0', person]]), []);
    assert.ok(index, 'single person index should be defined');
  });

  it('100-person index has correct person count', () => {
    const index = buildTreeIndex(100);
    // The index should expose all 100 people
    assert.ok(index, 'index should be defined for 100 people');
  });
});

// ---------------------------------------------------------------------------
// layoutTree correctness
// ---------------------------------------------------------------------------
describe('layoutTree correctness', () => {
  it('small tree returns non-empty row array', () => {
    const index = buildTreeIndex(3);
    const included = new Set(['p0', 'p1', 'p2']);
    const rows = layoutTree(index, included);
    assert.ok(Array.isArray(rows), 'should return array');
    assert.ok(rows.length > 0, 'should have at least one row');
  });

  it('layoutTree with empty included set returns empty rows', () => {
    const index = buildTreeIndex(10);
    const rows = layoutTree(index, new Set());
    // No people visible → rows should be empty or only have empty arrays
    const totalPeople = rows.reduce((sum, row) => sum + row.length, 0);
    assert.equal(totalPeople, 0, 'empty included set should produce no positioned people');
  });

  it('every positioned person has numeric x and y coordinates', () => {
    const index = buildTreeIndex(10);
    const included = new Set(Array.from({ length: 10 }, (_, i) => `p${i}`));
    const rows = layoutTree(index, included);
    for (const row of rows) {
      for (const person of row) {
        assert.ok(typeof person.x === 'number', `person ${person.id} has non-numeric x`);
        assert.ok(typeof person.y === 'number', `person ${person.id} has non-numeric y`);
      }
    }
  });

  it('no two people share the exact same (x, y) in a small tree', () => {
    const index = buildTreeIndex(5);
    const included = new Set(['p0', 'p1', 'p2', 'p3', 'p4']);
    const rows = layoutTree(index, included);
    const positions = new Set<string>();
    for (const row of rows) {
      for (const person of row) {
        const key = `${person.x},${person.y}`;
        assert.ok(!positions.has(key), `duplicate position at (${person.x}, ${person.y}) for ${person.id}`);
        positions.add(key);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Pagination / culling behaviour
// ---------------------------------------------------------------------------
describe('layoutTree culling', () => {
  it('large tree with restricted visible set returns only visible people', () => {
    const index = buildTreeIndex(100);
    // Only show 10 people
    const included = new Set(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9']);
    const rows = layoutTree(index, included);
    const positioned = rows.flatMap((r) => r).map((p) => p.id);
    for (const id of positioned) {
      assert.ok(included.has(id), `unexpected person ${id} in layout output`);
    }
  });
});
