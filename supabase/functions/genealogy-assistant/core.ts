export const tasks = [
  'summary',
  'questions',
  'gaps',
  'document',
  'matches',
  'interview',
  'biography',
  'relationship',
  'plan',
] as const;
export type Task = (typeof tasks)[number];
type Precision = 'unknown' | 'year' | 'month' | 'day';
type Person = {
  id: string;
  name: string;
  status: string;
  birth: string | null;
  death: string | null;
  birthPlace: string | null;
  deathPlace: string | null;
  birthPrecision: Precision;
  deathPrecision: Precision;
  birthApproximate: boolean;
  deathApproximate: boolean;
  occupation: string | null;
};
type Event = {
  id: string;
  title: string;
  day: string | null;
  precision: Precision;
  approximate: boolean;
};
type Source = {
  id: string;
  title: string;
  locator: string | null;
  personId: string | null;
  eventId: string | null;
};
type Edge = {
  id: string;
  a: string;
  b: string;
  kind: string;
  verified: boolean;
  relation: 'parent' | 'partner';
};
type Match = {
  id: string;
  title: string;
  year: number;
  place: string;
  collection: string;
  locator: string;
};
export type Context = {
  people: Person[];
  events: Event[];
  sources: Source[];
  edges: Edge[];
  edgeNames: Record<string, string>;
  matches: Match[];
};
export type Citation = {
  label: string;
  kind:
    | 'profile'
    | 'event'
    | 'record'
    | 'relationship'
    | 'document'
    | 'discovery';
  id?: string;
};
export type Statement = {
  id: number;
  status: 'verified' | 'reported' | 'unknown' | 'suggestion';
  category: string;
  text: string;
  citations: Citation[];
};

function formatDate(
  date: string | null,
  precision: Precision,
  approximate: boolean,
) {
  if (!date || precision === 'unknown') return '';
  return (
    (approximate ? 'about ' : '') +
    date.slice(0, precision === 'year' ? 4 : precision === 'month' ? 7 : 10)
  );
}

function pathBetween(edges: Edge[], start: string, end: string) {
  const neighbors = new Map<string, { edge: Edge; next: string }[]>();
  for (const edge of edges) {
    for (const [from, next] of [
      [edge.a, edge.b],
      [edge.b, edge.a],
    ]) {
      const entries = neighbors.get(from) ?? [];
      entries.push({ edge, next });
      neighbors.set(from, entries);
    }
  }
  const seen = new Set([start]);
  const queue = [
    { at: start, links: [] as { edge: Edge; from: string; to: string }[] },
  ];
  for (const current of queue) {
    if (current.at === end) return current.links;
    if (current.links.length >= 8) continue;
    for (const { edge, next } of neighbors.get(current.at) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push({
        at: next,
        links: [...current.links, { edge, from: current.at, to: next }],
      });
    }
  }
}

export function createStatements(task: Task, context: Context, document = '') {
  const statements: Statement[] = [];
  function add(
    status: Statement['status'],
    category: string,
    text: string,
    citations: Citation[] = [],
  ) {
    statements.push({
      id: statements.length + 1,
      status,
      category,
      text,
      citations,
    });
  }
  function profile(person: Person): Citation {
    return {
      label: `Profile of ${person.name}`,
      kind: 'profile',
      id: person.id,
    };
  }
  function sources(personId: string | null, eventId: string | null) {
    return context.sources
      .filter((source) =>
        eventId ? source.eventId === eventId : source.personId === personId,
      )
      .slice(0, 3)
      .map(
        (source): Citation => ({
          kind: 'record',
          id: source.id,
          label:
            'Linked source · ' +
            source.title +
            (source.locator ? ' · ' + source.locator : ''),
        }),
      );
  }
  const person = context.people[0];
  if (task === 'biography' || task === 'summary') {
    for (const item of context.people) {
      const citations = [profile(item), ...sources(item.id, null)];
      if (item.status !== 'verified') {
        add(
          'unknown',
          'profile-status',
          `The profile for ${item.name} has not been verified. Its details are excluded from the verified account.`,
          [profile(item)],
        );
        continue;
      }
      const birth = formatDate(
        item.birth,
        item.birthPrecision,
        item.birthApproximate,
      );
      const death = formatDate(
        item.death,
        item.deathPrecision,
        item.deathApproximate,
      );
      if (birth || item.birthPlace)
        add(
          'verified',
          'birth',
          `The verified profile records that ${item.name} was born${birth ? ' ' + birth : ''}${item.birthPlace ? ' in ' + item.birthPlace : ''}.`,
          citations,
        );
      if (item.occupation)
        add(
          'verified',
          'occupation',
          `The verified profile lists ${item.occupation} as ${item.name}’s occupation.`,
          citations,
        );
      if (death || item.deathPlace)
        add(
          'verified',
          'death',
          `The verified profile records that ${item.name} died${death ? ' ' + death : ''}${item.deathPlace ? ' in ' + item.deathPlace : ''}.`,
          citations,
        );
      const missing = [
        !birth && 'birth date',
        !item.birthPlace && 'birthplace',
        !death && 'death date',
        !item.deathPlace && 'place of death',
        !item.occupation && 'occupation',
      ].filter(Boolean);
      if (missing.length)
        add(
          'unknown',
          'gaps',
          `The verified profile for ${item.name} leaves these details unknown: ${missing.join(', ')}.`,
          [profile(item)],
        );
    }
    for (const event of context.events) {
      const date = formatDate(event.day, event.precision, event.approximate);
      add(
        'verified',
        'timeline',
        `The verified timeline records “${event.title}”${date ? ' (' + date + ')' : ' with no recorded date'}.`,
        [
          { kind: 'event', id: event.id, label: event.title },
          ...sources(null, event.id),
        ],
      );
    }
    if (!statements.length)
      add(
        'unknown',
        'gaps',
        'No verified family facts were available for this selection.',
      );
  } else if (task === 'gaps' && person) {
    for (const [field, value] of [
      ['birth date', person.birth],
      ['birthplace', person.birthPlace],
      ['death date', person.death],
      ['place of death', person.deathPlace],
      ['occupation', person.occupation],
    ])
      if (!value)
        add(
          'unknown',
          'gaps',
          `The profile for ${person.name} has no recorded ${field}.`,
          [profile(person)],
        );
    if (!statements.length)
      add(
        'reported',
        'profile-status',
        'The fields checked here are populated. Compare them with original records before relying on them.',
        [profile(person)],
      );
  } else if (task === 'document') {
    let quoted = 0;
    const lines = document.replace(/\r\n?/g, '\n').split('\n');
    for (const [index, line] of lines.entries()) {
      const text = line.trim();
      if (
        !text ||
        /ignore.{0,30}(instructions|previous)|system prompt|api key|secret token|tool call|fabricat|<\/?system/i.test(
          text,
        )
      )
        continue;
      if (quoted >= 5) break;
      const excerpt = text.length > 280 ? text.slice(0, 280) + '…' : text;
      const years = [
        ...new Set(text.match(/\b(?:1[5-9]\d{2}|20\d{2})\b/g) ?? []),
      ].slice(0, 6);
      add(
        'reported',
        'excerpt',
        `The supplied text reads “${excerpt}”${years.length ? ` and contains the year-like text ${years.join(', ')}` : ''}.`,
        [{ kind: 'document', label: `Supplied text · line ${index + 1}` }],
      );
      const terms = [
        [
          /\bbapti[sz](?:ed|m)\b/i,
          'Baptism records a religious ceremony. Its date can differ from the birth date.',
        ],
        [
          /\bcensus\b/i,
          'A census usually records a household at a particular time. People listed together may have different relationships.',
        ],
        [
          /\bwitness(?:es)?\b/i,
          'A witness is identified in connection with the event. That role alone does not establish kinship.',
        ],
        [
          /\bbur(?:ied|ial)\b/i,
          'Burial records when or where someone was interred. The death date may be different.',
        ],
        [
          /\bpassenger\b/i,
          'A passenger entry concerns a journey. It does not by itself prove permanent migration or citizenship.',
        ],
      ] as const;
      const term = terms.find(([pattern]) => pattern.test(text));
      if (term)
        add('reported', 'term', term[1], [
          { kind: 'document', label: `Supplied text · line ${index + 1}` },
        ]);
      quoted++;
    }
    add(
      'unknown',
      'limits',
      quoted
        ? 'The excerpt alone does not establish what the dates refer to, the document’s authenticity, or whether it concerns the same person.'
        : 'No usable descriptive lines were available. Supply a readable excerpt from the record.',
    );
    add(
      'suggestion',
      'document-check',
      'Compare the transcription with the original image, then look for the heading, date, issuer, and surrounding entries.',
    );
  } else if (task === 'matches') {
    for (const item of context.matches)
      add(
        'suggestion',
        'match',
        `Fictional practice match: ${item.title} (${item.year}, ${item.place}). Check name, place, and date independently.`,
        [{ kind: 'discovery', label: item.collection + ' · ' + item.locator }],
      );
    if (!statements.length)
      add(
        'unknown',
        'limits',
        'No matching practice records were found. Live historical search is unavailable here.',
      );
    add(
      'suggestion',
      'match-check',
      'Compare identifiers across original records before attaching a match or drawing a relationship conclusion.',
    );
  } else if (task === 'relationship') {
    const [start, end] = context.people;
    const edges = context.edges.slice(0, 600);
    const verified = pathBetween(
      edges.filter((edge) => edge.verified),
      start.id,
      end.id,
    );
    const path = verified ?? pathBetween(edges, start.id, end.id);
    const names = {
      ...context.edgeNames,
      [start.id]: start.name,
      [end.id]: end.name,
    };
    if (!path?.length)
      add(
        'unknown',
        'limits',
        'No supported path was found within the available links and search limits. This does not establish that the people are unrelated.',
      );
    for (const { edge, from, to } of path ?? []) {
      const description =
        edge.relation === 'parent'
          ? `${edge.kind} ${edge.a === from ? 'parent' : 'child'} of`
          : `${edge.kind} partner of`;
      add(
        edge.verified ? 'verified' : 'reported',
        'connection',
        `The tree links ${names[from] ?? 'an intermediate profile'} as ${description} ${names[to] ?? 'an intermediate profile'}.`,
        [
          {
            kind: 'relationship',
            id: edge.a,
            label: `Tree connection · ${edge.kind}`,
          },
        ],
      );
    }
    if (path?.length && !verified)
      add(
        'unknown',
        'limits',
        'This path includes unverified links. Treat the relationship as a research hypothesis.',
      );
  } else {
    const suggestions =
      task === 'interview'
        ? [
            'Ask the relative’s permission to record the interview and agree who can read or hear it.',
            'Start with an open question about a childhood home, then ask when it happened and who else remembers it.',
            'Ask the relative to identify the people, approximate date, and place in one family photograph.',
            'Record first-hand memories separately from stories passed down by others.',
          ]
        : task === 'plan'
          ? [
              'Start with the latest event you can document for the unknown ancestor, then work backward one record at a time.',
              'List name variants and the places associated with each record. Search nearby jurisdictions for the same time period.',
              'Compare witnesses, relatives, occupations, dates, and addresses from authorized records to distinguish people with similar names.',
              'Log each search, including unsuccessful ones, along with the source, date, and next question.',
            ]
          : [
              'Which original record could establish the earliest documented event?',
              'Which spellings, languages, and place names might appear in records from that period?',
              'What would distinguish this person from someone with the same name?',
              'Which family member or archive could clarify the biggest gap, and what would count as corroboration?',
            ];
    for (const text of suggestions) add('suggestion', 'research-step', text);
  }
  return statements.slice(0, 24);
}

// The external model sees only local item numbers and fixed categories.
export function publicOutline(task: Task, statements: Statement[]) {
  return {
    task,
    items: statements.map(({ id, status, category }) => ({
      id,
      status,
      category,
    })),
  };
}

export function applyOutline(
  statements: Statement[],
  output: unknown,
): Statement[] | undefined {
  if (
    !output ||
    typeof output !== 'object' ||
    Object.keys(output).length !== 1 ||
    !('order' in output) ||
    !Array.isArray(output.order)
  )
    return;
  const order: unknown[] = output.order;
  const byId = new Map(statements.map((item) => [item.id, item]));
  if (
    order.length !== statements.length ||
    new Set(order).size !== order.length ||
    !order.every(
      (id) => typeof id === 'number' && Number.isInteger(id) && byId.has(id),
    )
  )
    return;
  return order.map((id) => byId.get(id as number)!);
}
