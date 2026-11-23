import { endpoints, type Connection } from '../relationships/relationshipGraph';

export type TreePerson = {
  id: string;
  name: string;
  aliases: readonly string[];
  subtitle?: string;
};
export type TreeScope = 'full' | 'ancestors' | 'descendants';
export type Point = { x: number; y: number };
export type Rectangle = Point & { width: number; height: number };
export type PositionedPerson = Rectangle & {
  person: TreePerson;
  generation: number;
};
export type TreeLine = {
  connection: Connection;
  bounds: Rectangle;
  path: string;
  uncertain: boolean;
};
export type TreeTransform = Point & { scale: number };
export type Viewport = { width: number; height: number };

const cardWidth = 164;
const cardHeight = 72;
const columnStep = 216;
const rowStep = 152;
const margin = 36;

function usableParent(connection: Connection) {
  return (
    connection.category === 'parent' &&
    connection.provenance !== 'ai_suggested' &&
    connection.verification !== 'disputed'
  );
}

export function indexTree(
  people: readonly TreePerson[],
  connections: readonly Connection[],
) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const parents = new Map<string, Set<string>>();
  const children = new Map<string, Set<string>>();
  const connected = connections.filter((connection) => {
    const [a, b] = endpoints(connection);
    return a !== b && byId.has(a) && byId.has(b);
  });

  for (const link of connected) {
    if (link.category !== 'parent' || !usableParent(link)) continue;
    const incoming = parents.get(link.child) ?? new Set<string>();
    const outgoing = children.get(link.parent) ?? new Set<string>();
    incoming.add(link.parent);
    outgoing.add(link.child);
    parents.set(link.child, incoming);
    children.set(link.parent, outgoing);
  }

  return { byId, parents, children, connections: connected };
}

export type TreeIndex = ReturnType<typeof indexTree>;

export function visiblePeople(
  tree: TreeIndex,
  scope: TreeScope,
  focus: string | undefined,
  collapsed: ReadonlySet<string>,
) {
  const outgoing = scope === 'ancestors' ? tree.parents : tree.children;
  const incoming = scope === 'ancestors' ? tree.children : tree.parents;
  const full = scope === 'full';
  const starts = full
    ? [...tree.byId.keys()].filter((id) => !incoming.get(id)?.size)
    : focus
      ? [focus]
      : [];
  const visible = new Set<string>();
  function walk(entries: string[]) {
    for (let index = 0; index < entries.length; index++) {
      const id = entries[index];
      if (visible.has(id) || !tree.byId.has(id)) continue;
      visible.add(id);
      if (!collapsed.has(id)) entries.push(...(outgoing.get(id) ?? []));
    }
  }
  walk(starts);
  if (full) {
    // Keep isolated cyclic components from older/imported data navigable.
    const allReachable = new Set<string>();
    const queue = [...starts.filter((id) => !incoming.get(id)?.size)];
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index];
      if (allReachable.has(id)) continue;
      allReachable.add(id);
      queue.push(...(outgoing.get(id) ?? []));
    }
    for (const id of tree.byId.keys()) {
      if (!allReachable.has(id)) walk([id]);
    }
  }
  return visible;
}

function generations(tree: TreeIndex) {
  const rank = new Map<string, number>();
  const inDegree = new Map(
    [...tree.byId.keys()].map((id) => [id, tree.parents.get(id)?.size ?? 0]),
  );
  const queue = [...inDegree]
    .filter(([, count]) => count === 0)
    .map(([id]) => id);
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    const current = rank.get(id) ?? 1;
    rank.set(id, current);
    for (const child of tree.children.get(id) ?? []) {
      rank.set(child, Math.max(rank.get(child) ?? 1, current + 1));
      const remaining = (inDegree.get(child) ?? 0) - 1;
      inDegree.set(child, remaining);
      if (remaining === 0) queue.push(child);
    }
  }
  return rank;
}

function pathFor(
  a: PositionedPerson,
  b: PositionedPerson,
  link: Connection,
  offset: number,
): Point[] {
  const from = a.x + a.width / 2 + offset;
  const to = b.x + b.width / 2 + offset;
  if (link.category === 'parent' && a.y < b.y) {
    const sourceY = a.y + a.height;
    const topLane = sourceY + 22 + offset;
    const bottomLane = b.y - 20 - offset;
    const channel = b.x - 16 - offset;
    return a.x === b.x && b.y - a.y === rowStep
      ? [
          { x: from, y: sourceY },
          { x: to, y: b.y },
        ]
      : [
          { x: from, y: sourceY },
          { x: from, y: topLane },
          { x: channel, y: topLane },
          { x: channel, y: bottomLane },
          { x: to, y: bottomLane },
          { x: to, y: b.y },
        ];
  }
  const lane = (link.category === 'partnership' ? 18 : 30) + offset;
  if (a.y === b.y) {
    return [
      { x: from, y: a.y },
      { x: from, y: a.y - lane },
      { x: to, y: b.y - lane },
      { x: to, y: b.y },
    ];
  }
  const channel = b.x - 30 - offset;
  return [
    { x: from, y: a.y },
    { x: from, y: a.y - lane },
    { x: channel, y: a.y - lane },
    { x: channel, y: b.y - lane },
    { x: to, y: b.y - lane },
    { x: to, y: b.y },
  ];
}

export function layoutTree(tree: TreeIndex, included: ReadonlySet<string>) {
  const rank = generations(tree);
  const groups = new Map<number, TreePerson[]>();
  for (const id of included) {
    const person = tree.byId.get(id);
    if (!person) continue;
    const generation = rank.get(id) ?? 1;
    const row = groups.get(generation) ?? [];
    row.push(person);
    groups.set(generation, row);
  }

  const partners = new Map<string, string[]>();
  for (const link of tree.connections) {
    if (
      link.category !== 'partnership' ||
      !included.has(link.a) ||
      !included.has(link.b)
    )
      continue;
    if ((rank.get(link.a) ?? 1) !== (rank.get(link.b) ?? 1)) continue;
    for (const [a, b] of [
      [link.a, link.b],
      [link.b, link.a],
    ]) {
      const peers = partners.get(a) ?? [];
      peers.push(b);
      partners.set(a, peers);
    }
  }

  let widest = 1;
  for (const row of groups.values()) widest = Math.max(widest, row.length);
  const positions = new Map<string, PositionedPerson>();
  const rows: PositionedPerson[][] = [];
  const placement = [...groups].sort(([a], [b]) => a - b);
  placement.forEach(([generation, members], rowIndex) => {
    function parentCenter(id: string) {
      const previous = [...(tree.parents.get(id) ?? [])]
        .map((parent) => positions.get(parent)?.x)
        .filter((value): value is number => value !== undefined);
      return previous.length
        ? previous.reduce((sum, x) => sum + x, 0) / previous.length
        : Number.MAX_SAFE_INTEGER;
    }
    const centers = new Map(
      members.map((person) => [person.id, parentCenter(person.id)]),
    );
    members.sort(
      (a, b) =>
        (centers.get(a.id) ?? 0) - (centers.get(b.id) ?? 0) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );

    const ordered: TreePerson[] = [];
    const seen = new Set<string>();
    for (const member of members) {
      const queue = [member.id];
      for (let index = 0; index < queue.length; index++) {
        const id = queue[index];
        const person = tree.byId.get(id);
        if (seen.has(id) || !person) continue;
        seen.add(id);
        ordered.push(person);
        queue.push(...(partners.get(id) ?? []));
      }
    }

    const offset = Math.floor((widest - ordered.length) / 2);
    rows.push(
      ordered.map((person, column) => {
        const positioned = {
          person,
          generation,
          x: margin + (column + offset) * columnStep,
          y: margin + rowIndex * rowStep,
          width: cardWidth,
          height: cardHeight,
        };
        positions.set(person.id, positioned);
        return positioned;
      }),
    );
  });

  const lines: TreeLine[] = [];
  const pairs = new Map<string, number>();
  for (const connection of tree.connections) {
    const [first, second] = endpoints(connection);
    const a = positions.get(first);
    const b = positions.get(second);
    if (!a || !b) continue;
    const pair = JSON.stringify([first, second].sort());
    const occurrence = pairs.get(pair) ?? 0;
    const offset = (occurrence % 4) * 4;
    pairs.set(pair, occurrence + 1);
    const points = pathFor(a, b, connection, offset);
    const x = Math.min(...points.map((point) => point.x));
    const y = Math.min(...points.map((point) => point.y));
    lines.push({
      connection,
      bounds: {
        x,
        y,
        width: Math.max(...points.map((point) => point.x)) - x,
        height: Math.max(...points.map((point) => point.y)) - y,
      },
      path: points
        .map(
          (point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`,
        )
        .join(' '),
      uncertain:
        connection.provenance === 'ai_suggested' ||
        connection.verification === 'disputed',
    });
  }

  return {
    positions,
    rows,
    lines,
    width: 2 * margin + (widest - 1) * columnStep + cardWidth,
    height: 2 * margin + Math.max(0, rows.length - 1) * rowStep + cardHeight,
  };
}

export function viewBounds(
  viewport: Viewport,
  transform: TreeTransform,
  overscan = 60,
): Rectangle {
  const extra = overscan / transform.scale;
  return {
    x: -transform.x / transform.scale - extra,
    y: -transform.y / transform.scale - extra,
    width: viewport.width / transform.scale + 2 * extra,
    height: viewport.height / transform.scale + 2 * extra,
  };
}

export function overlaps(a: Rectangle, b: Rectangle) {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

export function inView(rows: readonly PositionedPerson[][], bounds: Rectangle) {
  const visible: PositionedPerson[] = [];
  for (const row of rows) {
    if (
      !row.length ||
      row[0].y > bounds.y + bounds.height ||
      row[0].y + row[0].height < bounds.y
    )
      continue;
    let low = 0;
    let high = row.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (row[mid].x + row[mid].width < bounds.x) low = mid + 1;
      else high = mid;
    }
    for (
      let index = low;
      index < row.length && row[index].x <= bounds.x + bounds.width;
      index++
    )
      visible.push(row[index]);
  }
  return visible;
}

export function zoomAt(
  transform: TreeTransform,
  factor: number,
  anchor: Point,
): TreeTransform {
  const scale = Math.min(2.5, Math.max(0.06, transform.scale * factor));
  const ratio = scale / transform.scale;
  return {
    scale,
    x: anchor.x - (anchor.x - transform.x) * ratio,
    y: anchor.y - (anchor.y - transform.y) * ratio,
  };
}

export function centerOn(
  transform: TreeTransform,
  viewport: Viewport,
  point: Point,
): TreeTransform {
  return {
    scale: transform.scale,
    x: viewport.width / 2 - point.x * transform.scale,
    y: viewport.height / 2 - point.y * transform.scale,
  };
}
