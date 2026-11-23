import type { FamilySnapshot, Workspace } from '@/types/family';
import type { Connection } from '@/features/relationships/relationshipGraph';

import type { TreePerson } from './treeLayout';

const sampleNames = [
  'Ana',
  'Boris',
  'Cora',
  'Dorian',
  'Emil',
  'Faye',
  'Gabriel',
  'Helena',
  'Ivo',
  'Julia',
  'Kiril',
  'Lea',
];
const examplePeople: TreePerson[] = [];
const exampleLinks: Connection[] = [];
const history = {
  notes: null,
  provenance: 'documented',
  verification: 'verified',
} as const;

function link(
  parent: string,
  child: string,
  kind: 'biological' | 'adoptive' | 'step' = 'biological',
): Connection {
  return {
    ...history,
    category: 'parent',
    id: `demo-${parent}-${child}-${kind}`,
    parent,
    child,
    kind,
  };
}

function partner(a: string, b: string, former = false): Connection {
  return {
    ...history,
    category: 'partnership',
    id: `demo-${a}-${b}`,
    a,
    b,
    kind: 'marriage',
    status: former ? 'former' : 'current',
    startedOn: null,
    startPrecision: 'unknown',
    startApproximate: false,
    endedOn: null,
    endPrecision: 'unknown',
    endApproximate: false,
  };
}

const generationSizes = [5, 10, 18, 30, 57];
let preceding: TreePerson[] = [];
generationSizes.forEach((size, rank) => {
  const row = Array.from(
    { length: size },
    (_, index): TreePerson => ({
      id: `example-${rank + 1}-${index + 1}`,
      name: `${sampleNames[(rank * 3 + index) % sampleNames.length]} Moreau ${rank + 1}.${index + 1}`,
      aliases: [`Sample relative ${rank + 1}.${index + 1}`],
    }),
  );
  for (let index = 0; index < row.length; index++) {
    const person = row[index];
    if (preceding.length) {
      const parent = Math.floor((index * preceding.length) / row.length);
      exampleLinks.push(
        link(
          preceding[parent].id,
          person.id,
          index % 7 === 0 ? 'adoptive' : 'biological',
        ),
      );
      if (index % 4 === 0)
        exampleLinks.push(
          link(
            preceding[(parent + 1) % preceding.length].id,
            person.id,
            'step',
          ),
        );
    }
    if (index % 4 === 1)
      exampleLinks.push(partner(row[index - 1].id, person.id));
    if (index % 8 === 2)
      exampleLinks.push(partner(row[index - 2].id, person.id, true));
  }
  examplePeople.push(...row);
  preceding = row;
});

const starterLinks: Connection[] = [
  link('rosa', 'lucien'),
  link('lucien', 'claire'),
  link('margot', 'claire'),
  link('claire', 'elena'),
  link('claire', 'julien'),
  partner('lucien', 'margot'),
  link('rosa', 'example-1-1', 'adoptive'),
];

export function demoTree(snapshot: FamilySnapshot, workspace: Workspace) {
  const people = snapshot.people.map(
    (person): TreePerson => ({
      id: person.id,
      name: person.name,
      aliases: [],
      subtitle: person.birthYear ? `Born ${person.birthYear}` : undefined,
    }),
  );
  const links = snapshot.people.flatMap((person) =>
    person.relativeTo && person.relativeDirection
      ? [
          person.relativeDirection === 'parent'
            ? link(person.id, person.relativeTo)
            : link(person.relativeTo, person.id),
        ]
      : [],
  );
  return workspace === 'sample'
    ? {
        people: [...people, ...examplePeople],
        connections: [...starterLinks, ...exampleLinks, ...links],
      }
    : { people, connections: links };
}
