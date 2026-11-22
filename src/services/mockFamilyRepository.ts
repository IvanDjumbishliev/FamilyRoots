import type {
  Activity,
  FamilyRepository,
  FamilySnapshot,
  Person,
  Workspace,
} from '../types/family';

const samplePeople: readonly Person[] = [
  {
    id: 'rosa',
    name: 'Rosa Moreau',
    relation: 'Great-grandmother',
    generation: 1,
    birthYear: 1912,
    createdAt: '2026-11-15T12:00:00Z',
  },
  {
    id: 'lucien',
    name: 'Lucien Moreau',
    relation: 'Grandfather',
    generation: 2,
    birthYear: 1938,
    createdAt: '2026-11-16T12:00:00Z',
  },
  {
    id: 'margot',
    name: 'Margot Dubois',
    relation: 'Grandmother',
    generation: 2,
    birthYear: 1942,
    createdAt: '2026-11-17T12:00:00Z',
  },
  {
    id: 'claire',
    name: 'Claire Moreau',
    relation: 'Mother',
    generation: 3,
    birthYear: 1966,
    createdAt: '2026-11-19T12:00:00Z',
  },
  {
    id: 'elena',
    name: 'Elena Moreau',
    generation: 4,
    birthYear: 1994,
    createdAt: '2026-11-18T12:00:00Z',
  },
  {
    id: 'julien',
    name: 'Julien Moreau',
    relation: 'Brother',
    generation: 4,
    birthYear: 1998,
    createdAt: '2026-11-20T12:00:00Z',
  },
];

export function createMockFamilyRepository(
  now = () => new Date(),
): FamilyRepository {
  const empty: FamilySnapshot = {
    profileName: 'Elena',
    familyName: 'Your family',
    people: [],
    memories: [],
    books: [],
    activity: [],
    history: [],
  };
  const snapshots: Record<Workspace, FamilySnapshot> = {
    empty,
    sample: {
      ...empty,
      familyName: 'The Moreau family',
      people: samplePeople,
      history: [{ id: 'move', year: 1972, label: 'The family moved to Lyon' }],
      activity: samplePeople.slice(-3).map((person) => ({
        id: person.id,
        label: `Added ${person.name} to the tree`,
        createdAt: person.createdAt,
      })),
    },
  };
  const listeners = new Set<() => void>();
  let sequence = 0;

  function write(
    workspace: Workspace,
    label: string,
    update: (snapshot: FamilySnapshot, activity: Activity) => FamilySnapshot,
  ) {
    const activity = {
      id: `entry-${++sequence}`,
      label,
      createdAt: now().toISOString(),
    };
    const updated = update(snapshots[workspace], activity);
    snapshots[workspace] = {
      ...updated,
      activity: [activity, ...updated.activity],
    };
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot: (workspace) => snapshots[workspace],
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async addPerson(workspace, person) {
      write(
        workspace,
        `Added ${person.name} to the tree`,
        (snapshot, { id, createdAt }) => ({
          ...snapshot,
          people: [{ ...person, id, createdAt }, ...snapshot.people],
        }),
      );
    },
    async addMemory(workspace, memory) {
      write(
        workspace,
        `Added ${memory.name} to the archive`,
        (snapshot, { id, createdAt }) => ({
          ...snapshot,
          memories: [{ ...memory, id, createdAt }, ...snapshot.memories],
        }),
      );
    },
    async createBook(workspace, title) {
      write(
        workspace,
        `Created the book draft ${title}`,
        (snapshot, { id, createdAt }) => ({
          ...snapshot,
          books: [
            {
              id,
              title,
              createdAt,
              chapters: [
                'Our family tree',
                'Family milestones',
                'Memories to keep',
              ],
            },
            ...snapshot.books,
          ],
        }),
      );
    },
  };
}
