export type ParentKind =
  | 'biological'
  | 'adoptive'
  | 'step'
  | 'foster'
  | 'guardian'
  | 'other';
export type PartnerKind =
  | 'marriage'
  | 'civil_union'
  | 'domestic_partnership'
  | 'other';
export type PartnerStatus = 'unknown' | 'current' | 'former';
export type Provenance =
  | 'user_reported'
  | 'documented'
  | 'imported'
  | 'ai_suggested';
export type Verification = 'unverified' | 'verified' | 'disputed';
export type Precision = 'unknown' | 'year' | 'month' | 'day';

type Evidence = {
  id: string;
  provenance: Provenance;
  verification: Verification;
  notes: string | null;
};
export type ParentLink = Evidence & {
  category: 'parent';
  parent: string;
  child: string;
  kind: ParentKind;
};
export type PartnerLink = Evidence & {
  category: 'partnership';
  a: string;
  b: string;
  kind: PartnerKind;
  status: PartnerStatus;
  startedOn: string | null;
  startPrecision: Precision;
  startApproximate: boolean;
  endedOn: string | null;
  endPrecision: Precision;
  endApproximate: boolean;
};
export type OtherLink = Evidence & {
  category: 'other';
  a: string;
  b: string;
  label: string;
};
export type Connection = ParentLink | PartnerLink | OtherLink;
export type PathStep = { from: string; to: string; connection: Connection };

export const parentKinds = [
  { value: 'biological', label: 'Biological' },
  { value: 'adoptive', label: 'Adoptive' },
  { value: 'step', label: 'Step' },
  { value: 'foster', label: 'Foster' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'other', label: 'Other parental relationship' },
] as const;
export const partnerKinds = [
  { value: 'marriage', label: 'Marriage' },
  { value: 'civil_union', label: 'Civil union' },
  { value: 'domestic_partnership', label: 'Domestic partnership' },
  { value: 'other', label: 'Other partnership' },
] as const;
export const partnerStatuses = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'current', label: 'Current' },
  { value: 'former', label: 'Former' },
] as const;

export function endpoints(link: Connection): readonly [string, string] {
  return link.category === 'parent'
    ? [link.parent, link.child]
    : [link.a, link.b];
}

export function connectionLabel(link: Connection, from: string) {
  if (link.category === 'other') return link.label;
  if (link.category === 'partnership') {
    const role = link.kind === 'marriage' ? 'spouse' : 'partner';
    return link.status === 'former'
      ? `Former ${role}`
      : role.charAt(0).toUpperCase() + role.slice(1);
  }
  const targetIsParent = from === link.child;
  switch (link.kind) {
    case 'step':
      return targetIsParent ? 'Step-parent' : 'Stepchild';
    case 'guardian':
      return targetIsParent ? 'Guardian' : 'Ward';
    case 'other':
      return targetIsParent ? 'Other parent' : 'Child (other)';
    case 'adoptive':
      return targetIsParent ? 'Adoptive parent' : 'Adopted child';
    case 'foster':
      return targetIsParent ? 'Foster parent' : 'Foster child';
    default:
      return targetIsParent ? 'Biological parent' : 'Biological child';
  }
}

function supported(link: Connection) {
  return link.provenance !== 'ai_suggested' && link.verification !== 'disputed';
}

function addTo(map: Map<string, Set<string>>, key: string, value: string) {
  const values = map.get(key) ?? new Set<string>();
  values.add(value);
  map.set(key, values);
}

export function buildFamilyGraph(
  people: readonly string[],
  connections: readonly Connection[],
) {
  const peopleSet = new Set(people);
  const parents = new Map<string, Set<string>>();
  const children = new Map<string, Set<string>>();
  const links = new Map<string, PathStep[]>();
  for (const connection of connections) {
    const [a, b] = endpoints(connection);
    if (
      a === b ||
      !peopleSet.has(a) ||
      !peopleSet.has(b) ||
      !supported(connection)
    )
      continue;
    for (const [from, to] of [
      [a, b],
      [b, a],
    ]) {
      const step = { from, to, connection };
      const list = links.get(from) ?? [];
      list.push(step);
      links.set(from, list);
    }
    if (
      connection.category === 'parent' &&
      (connection.kind === 'biological' || connection.kind === 'adoptive')
    ) {
      addTo(parents, connection.child, connection.parent);
      addTo(children, connection.parent, connection.child);
    }
  }

  const dependencies = new Map(
    people.map((id) => [id, parents.get(id)?.size ?? 0]),
  );
  const queue = [...dependencies]
    .filter(([, count]) => count === 0)
    .map(([id]) => id);
  const generations = new Map(queue.map((id) => [id, 1]));
  const pending = new Map<string, number>();
  for (let index = 0; index < queue.length; index++) {
    const person = queue[index];
    const nextGeneration = (generations.get(person) ?? 1) + 1;
    for (const child of children.get(person) ?? []) {
      pending.set(child, Math.max(pending.get(child) ?? 1, nextGeneration));
      const remaining = (dependencies.get(child) ?? 0) - 1;
      dependencies.set(child, remaining);
      if (remaining === 0) {
        generations.set(child, pending.get(child) ?? 1);
        queue.push(child);
      }
    }
  }

  function expand(
    person: string,
    first: Map<string, Set<string>>,
    second: Map<string, Set<string>>,
  ) {
    const result = new Set<string>();
    for (const intermediate of first.get(person) ?? []) {
      for (const relative of second.get(intermediate) ?? []) {
        if (relative !== person) result.add(relative);
      }
    }
    return [...result].sort();
  }

  function ancestry(person: string) {
    const distances = new Map<
      string,
      { id: string; depth: number; via: string }
    >();
    const visited = new Set([person]);
    const queue = [{ id: person, depth: 0 }];
    for (let index = 0; index < queue.length; index++) {
      const { id, depth } = queue[index];
      for (const parent of [...(parents.get(id) ?? [])].sort()) {
        if (visited.has(parent)) continue;
        visited.add(parent);
        const ancestor = { id: parent, depth: depth + 1, via: id };
        distances.set(parent, ancestor);
        queue.push(ancestor);
      }
    }
    return [...distances.values()];
  }

  function relationshipPath(from: string, to: string): PathStep[] | undefined {
    if (!peopleSet.has(from) || !peopleSet.has(to)) return undefined;
    if (from === to) return [];
    const previous = new Map<string, PathStep>();
    const seen = new Set([from]);
    const queue = [from];
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      for (const step of links.get(current) ?? []) {
        if (seen.has(step.to)) continue;
        previous.set(step.to, step);
        seen.add(step.to);
        if (step.to === to) {
          const path: PathStep[] = [];
          let edge: PathStep | undefined = step;
          while (edge) {
            path.push(edge);
            edge = previous.get(edge.from);
          }
          return path.reverse();
        }
        queue.push(step.to);
      }
    }
    return undefined;
  }

  return {
    generations,
    unresolvedGenerations: [...peopleSet].filter((id) => !generations.has(id)),
    siblings: (person: string) => expand(person, parents, children),
    grandparents: (person: string) => expand(person, parents, parents),
    grandchildren: (person: string) => expand(person, children, children),
    ancestry,
    relationshipPath,
  };
}

export function possibleDuplicateName(
  name: string,
  candidates: readonly string[],
) {
  const normalize = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .split(/\s+/)
      .sort()
      .join(' ');
  const query = normalize(name);
  return query
    ? candidates.some((candidate) => normalize(candidate) === query)
    : false;
}
