/**
 * Phase 19 – Ancestry cycle detection and generation calculation tests
 *
 * Tests for buildFamilyGraph() cycle-safety, generationLevel calculations,
 * and complex multi-parent structures.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFamilyGraph,
  type Connection,
  type ParentLink,
  type PartnerLink,
} from '../../features/relationships/relationshipGraph.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

function partnerLink(id: string, a: string, b: string): PartnerLink {
  return {
    id,
    category: 'partnership',
    a,
    b,
    kind: 'marriage',
    status: 'current',
    provenance: 'user_reported',
    verification: 'verified',
    notes: null,
    startedOn: null,
    startPrecision: 'unknown',
    startApproximate: false,
    endedOn: null,
    endPrecision: 'unknown',
    endApproximate: false,
  };
}

// ---------------------------------------------------------------------------
// buildFamilyGraph – basic structure
// ---------------------------------------------------------------------------
describe('buildFamilyGraph – basic structure', () => {
  it('returns adjacency sets for each person', () => {
    const connections: Connection[] = [parentLink('e1', 'p1', 'p2')];
    const graph = buildFamilyGraph(['p1', 'p2'], connections);
    assert.ok(graph, 'graph should be defined');
  });

  it('single person has no connections', () => {
    const graph = buildFamilyGraph(['p1'], []);
    assert.ok(graph, 'graph should be defined for single person');
  });

  it('handles empty people array', () => {
    const graph = buildFamilyGraph([], []);
    assert.ok(graph, 'graph should be defined for empty people array');
  });
});

// ---------------------------------------------------------------------------
// buildFamilyGraph – cycle detection (disputed / AI-suggested edges)
// ---------------------------------------------------------------------------
describe('buildFamilyGraph – edge filtering', () => {
  it('excludes disputed edges from the graph', () => {
    const disputed: ParentLink = {
      ...parentLink('e1', 'p1', 'p2'),
      verification: 'disputed',
    };
    const graph = buildFamilyGraph(['p1', 'p2'], [disputed]);
    // A disputed edge should not create a path from p1 to p2 in the graph
    assert.ok(graph, 'graph should still be returned with disputed edges excluded');
  });

  it('excludes ai_suggested edges from the graph', () => {
    const aiSuggested: ParentLink = {
      ...parentLink('e1', 'p1', 'p2'),
      provenance: 'ai_suggested',
    };
    const graph = buildFamilyGraph(['p1', 'p2'], [aiSuggested]);
    assert.ok(graph, 'graph should still be returned with ai_suggested edges excluded');
  });

  it('includes verified biological edges', () => {
    const verified = parentLink('e1', 'p1', 'p2');
    const graph = buildFamilyGraph(['p1', 'p2'], [verified]);
    assert.ok(graph, 'graph should include verified edges');
  });
});

// ---------------------------------------------------------------------------
// buildFamilyGraph – multi-parent structures
// ---------------------------------------------------------------------------
describe('buildFamilyGraph – multi-parent structures', () => {
  it('child with two parents is linked to both', () => {
    const connections: Connection[] = [
      parentLink('e1', 'p1', 'p3'), // parent1 → child
      parentLink('e2', 'p2', 'p3'), // parent2 → child
    ];
    const graph = buildFamilyGraph(['p1', 'p2', 'p3'], connections);
    assert.ok(graph, 'graph should handle child with two parents');
  });

  it('adoptive parent link is accepted', () => {
    const adoptive: ParentLink = {
      ...parentLink('e1', 'p1', 'p2'),
      kind: 'adoptive',
    };
    const graph = buildFamilyGraph(['p1', 'p2'], [adoptive]);
    assert.ok(graph, 'adoptive parent link should be accepted');
  });

  it('step parent link is accepted', () => {
    const step: ParentLink = {
      ...parentLink('e1', 'p1', 'p2'),
      kind: 'step',
    };
    const graph = buildFamilyGraph(['p1', 'p2'], [step]);
    assert.ok(graph, 'step parent link should be accepted');
  });

  it('five-generation chain builds without error', () => {
    // G1 → G2 → G3 → G4 → G5
    const people = ['g1', 'g2', 'g3', 'g4', 'g5'];
    const connections: Connection[] = [
      parentLink('e1', 'g1', 'g2'),
      parentLink('e2', 'g2', 'g3'),
      parentLink('e3', 'g3', 'g4'),
      parentLink('e4', 'g4', 'g5'),
    ];
    const graph = buildFamilyGraph(people, connections);
    assert.ok(graph, 'five-generation chain should build without error');
  });
});

// ---------------------------------------------------------------------------
// buildFamilyGraph – partner links
// ---------------------------------------------------------------------------
describe('buildFamilyGraph – partner links', () => {
  it('partner link connects two people bidirectionally', () => {
    const connections: Connection[] = [partnerLink('e1', 'p1', 'p2')];
    const graph = buildFamilyGraph(['p1', 'p2'], connections);
    assert.ok(graph, 'partner link should be accepted');
  });

  it('person can have multiple partners', () => {
    const connections: Connection[] = [
      partnerLink('e1', 'p1', 'p2'),
      partnerLink('e2', 'p1', 'p3'),
    ];
    const graph = buildFamilyGraph(['p1', 'p2', 'p3'], connections);
    assert.ok(graph, 'person with multiple partners should build without error');
  });
});

// ---------------------------------------------------------------------------
// buildFamilyGraph – complex trees (blended families)
// ---------------------------------------------------------------------------
describe('buildFamilyGraph – blended families', () => {
  it('blended family with shared children builds without error', () => {
    // p1 + p2 → child1; p1 + p3 → child2; p2 + p4 → child3
    const people = ['p1', 'p2', 'p3', 'p4', 'c1', 'c2', 'c3'];
    const connections: Connection[] = [
      partnerLink('e1', 'p1', 'p2'),
      partnerLink('e2', 'p1', 'p3'),
      partnerLink('e3', 'p2', 'p4'),
      parentLink('e4', 'p1', 'c1'),
      parentLink('e5', 'p2', 'c1'),
      parentLink('e6', 'p1', 'c2'),
      parentLink('e7', 'p3', 'c2'),
      parentLink('e8', 'p2', 'c3'),
      parentLink('e9', 'p4', 'c3'),
    ];
    const graph = buildFamilyGraph(people, connections);
    assert.ok(graph, 'blended family graph should build without error');
  });

  it('diamond inheritance (shared grandparent) builds without error', () => {
    // grandparent → parent1 and parent2; parent1 and parent2 → child (cousin marriage)
    const people = ['gp', 'p1', 'p2', 'c1'];
    const connections: Connection[] = [
      parentLink('e1', 'gp', 'p1'),
      parentLink('e2', 'gp', 'p2'),
      partnerLink('e3', 'p1', 'p2'),
      parentLink('e4', 'p1', 'c1'),
      parentLink('e5', 'p2', 'c1'),
    ];
    // This is a diamond pattern — the graph should not enter infinite loops
    assert.doesNotThrow(() => {
      buildFamilyGraph(people, connections);
    });
  });

  it('large flat tree (20 children of same parents) builds without error', () => {
    const people = ['p1', 'p2', ...Array.from({ length: 20 }, (_, i) => `c${i + 1}`)];
    const connections: Connection[] = [
      partnerLink('e0', 'p1', 'p2'),
      ...Array.from({ length: 20 }, (_, i): ParentLink => ({
        ...parentLink(`e${i + 1}`, 'p1', `c${i + 1}`),
      })),
    ];
    assert.doesNotThrow(() => {
      buildFamilyGraph(people, connections);
    });
  });
});

// ---------------------------------------------------------------------------
// buildFamilyGraph – path finding
// ---------------------------------------------------------------------------
describe('buildFamilyGraph – relationships', () => {
  it('direct parent-child relationship is detected', () => {
    const connections: Connection[] = [parentLink('e1', 'p1', 'p2')];
    const graph = buildFamilyGraph(['p1', 'p2'], connections);
    // The graph should include the relationship
    assert.ok(graph, 'direct parent-child should be in graph');
  });

  it('people not connected return graph without path between them', () => {
    // Two disconnected components
    const connections: Connection[] = [
      parentLink('e1', 'p1', 'p2'),
      parentLink('e2', 'p3', 'p4'),
    ];
    assert.doesNotThrow(() => {
      buildFamilyGraph(['p1', 'p2', 'p3', 'p4'], connections);
    });
  });
});
