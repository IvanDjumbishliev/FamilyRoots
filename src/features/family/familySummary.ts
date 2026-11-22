import type { FamilySnapshot, HistoryEvent, Person } from '../../types/family';

export function groupGenerations(people: readonly Person[]) {
  const groups = new Map<number, Person[]>();
  for (const person of people) {
    const members = groups.get(person.generation) ?? [];
    members.push(person);
    groups.set(person.generation, members);
  }
  return [...groups].sort(([first], [second]) => first - second);
}

export function searchPeople(people: readonly Person[], query: string) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return [];
  return people.filter((person) =>
    [person.name, person.relation].some((value) =>
      value?.toLocaleLowerCase().includes(term),
    ),
  );
}

export function summarizeFamily(snapshot: FamilySnapshot) {
  const milestones = snapshot.people.flatMap<HistoryEvent>((person) =>
    person.birthYear === undefined
      ? []
      : [
          {
            id: person.id,
            year: person.birthYear,
            label: `${person.name} was born`,
          },
        ],
  );
  return {
    memberCount: snapshot.people.length,
    generationCount: groupGenerations(snapshot.people).length,
    recentPeople: [...snapshot.people]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3),
    timeline: [...snapshot.history, ...milestones]
      .sort((a, b) => b.year - a.year)
      .slice(0, 4),
    activity: [...snapshot.activity]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 4),
  };
}
