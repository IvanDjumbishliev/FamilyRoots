export const eventTypes = [
  { value: 'birth', label: 'Birth' },
  { value: 'partnership', label: 'Marriage or partnership' },
  { value: 'death', label: 'Death' },
  { value: 'migration', label: 'Migration' },
  { value: 'education', label: 'Education' },
  { value: 'occupation', label: 'Occupation' },
  { value: 'military_service', label: 'Military service' },
  { value: 'residence', label: 'Residence' },
  { value: 'custom', label: 'Custom family milestone' },
] as const;

export type EventType = (typeof eventTypes)[number]['value'];
export type TimelineKind = 'family' | 'context';
export type TimelinePrecision = 'unknown' | 'year' | 'month' | 'day';
export type TimelineEvent = {
  id: string;
  title: string;
  type: EventType;
  kind: TimelineKind;
  date: string | null;
  precision: TimelinePrecision;
  approximate: boolean;
  verification: 'verified' | 'unverified' | 'disputed';
  place?: string | null;
  notes?: string | null;
  people: readonly string[];
  items: readonly string[];
  sources: readonly string[];
};

export function normalizeEventType(type: string): EventType {
  return eventTypes.find((event) => event.value === type)?.value ?? 'custom';
}

export function eventDateLabel(
  event: Pick<TimelineEvent, 'date' | 'precision' | 'approximate'>,
) {
  if (!event.date || event.precision === 'unknown') return 'Date unknown';
  const value = event.date.slice(
    0,
    event.precision === 'year' ? 4 : event.precision === 'month' ? 7 : 10,
  );
  return event.approximate ? `About ${value}` : value;
}

export type TimelineFilters = {
  type?: EventType;
  person?: string;
  branch?: ReadonlySet<string>;
  from?: number;
  to?: number;
  includeUndated: boolean;
};

export function filterTimeline(
  events: readonly TimelineEvent[],
  filters: TimelineFilters,
) {
  return events.filter((event) => {
    if (filters.type && filters.type !== event.type) return false;
    if (filters.person && !event.people.includes(filters.person)) return false;
    if (filters.branch && !event.people.some((id) => filters.branch?.has(id)))
      return false;
    if (!event.date || event.precision === 'unknown')
      return filters.includeUndated;
    const year = Number(event.date.slice(0, 4));
    return (
      (filters.from === undefined || year >= filters.from) &&
      (filters.to === undefined || year <= filters.to)
    );
  });
}

function order(first: TimelineEvent, second: TimelineEvent) {
  if (first.date && second.date)
    return (
      first.date.localeCompare(second.date) ||
      first.title.localeCompare(second.title) ||
      first.id.localeCompare(second.id)
    );
  if (first.date || second.date) return first.date ? -1 : 1;
  return (
    first.title.localeCompare(second.title) || first.id.localeCompare(second.id)
  );
}

export function groupTimeline(
  events: readonly TimelineEvent[],
  unit: 'decade' | 'century',
) {
  const collection = new Map<string, TimelineEvent[]>();
  for (const event of [...events].sort(order)) {
    const year =
      event.date && event.precision !== 'unknown'
        ? Number(event.date.slice(0, 4))
        : undefined;
    const section =
      year === undefined
        ? 'Date unknown'
        : unit === 'decade'
          ? `${Math.floor(year / 10) * 10}s`
          : `${Math.floor((year - 1) / 100) * 100 + 1}–${Math.ceil(year / 100) * 100}`;
    const group = collection.get(section) ?? [];
    group.push(event);
    collection.set(section, group);
  }
  return [...collection].map(([period, entries]) => ({ period, entries }));
}

/** Neutral book input, preserving dates, evidence identifiers and context boundaries. */
export function timelineForBook(
  events: readonly TimelineEvent[],
  groupBy: 'decade' | 'century' = 'decade',
) {
  return {
    family: groupTimeline(
      events.filter((event) => event.kind === 'family'),
      groupBy,
    ),
    historicalContext: groupTimeline(
      events.filter((event) => event.kind === 'context'),
      groupBy,
    ),
  };
}

export function parseYearFilter(fromText: string, toText: string) {
  function year(value: string) {
    const text = value.trim();
    if (!text) return undefined;
    if (!/^\d{4}$/.test(text) || Number(text) < 1) return null;
    return Number(text);
  }
  const from = year(fromText),
    to = year(toText);
  if (from === null || to === null)
    return { error: 'Enter years as YYYY.' } as const;
  if (from !== undefined && to !== undefined && from > to)
    return {
      error: 'The start year must come before or match the end year.',
    } as const;
  return { from, to };
}
