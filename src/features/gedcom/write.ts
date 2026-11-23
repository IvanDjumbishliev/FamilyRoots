import {
  maxPeople,
  maxRecords,
  months,
  timelineKinds,
  type Citation,
  type HistoricalDate,
  type Transfer,
} from './model';

const extensions = [
  '_FR_NAME',
  '_FR_LIVING',
  '_FR_BIO',
  '_FR_VITAL',
  '_FR_PARENT',
  '_FR_PARTNER',
  '_FR_STATUS',
  '_FR_START',
  '_FR_END',
  '_FR_TYPE',
  '_FR_PART',
  '_FR_URL',
];
const nameText = (value: string) => value.replace(/[\r\n/]/gu, ' ');

function formatDate({ date, precision, approximate }: HistoricalDate) {
  if (!date) return '';
  const [year, month, day] = date.split('-');
  const prefix = approximate ? 'ABT ' : '';
  if (precision === 'year') return prefix + year;
  return (
    prefix +
    (precision === 'day' ? Number(day) + ' ' : '') +
    months[Number(month) - 1] +
    ' ' +
    year
  );
}

export function writeGedcom(data: Transfer) {
  if (!data.people.length)
    throw new Error('This export has no eligible people.');
  if (
    data.people.length > maxPeople ||
    data.people.length +
      data.parents.length +
      data.partners.length +
      data.events.length +
      data.sources.length +
      2 >
      maxRecords
  )
    throw new Error('This selection exceeds the GEDCOM export record limit.');
  const rows = [
    '0 HEAD',
    '1 GEDC',
    '2 VERS 7.0',
    '1 SOUR FAMILYROOTS',
    '2 NAME FamilyRoots AI',
    '1 SCHMA',
  ];
  const people = new Map(
    data.people.map((person, index) => [person.ref, `@I${index + 1}@`]),
  );
  const sources = new Map(
    data.sources.map((source, index) => [source.ref, `@S${index + 1}@`]),
  );
  type FamilyLink = { family: string; child: boolean; pedigree?: string };
  const families = new Map<string, FamilyLink[]>();
  const familyRows: string[] = [];
  for (const tag of extensions)
    rows.push(
      `2 TAG ${tag} urn:familyroots:gedcom:${tag.slice(4).toLowerCase()}`,
    );
  let output = familyRows;
  function line(level: number, tag: string, value = '') {
    const normalized = value.replace(/\r\n?/gu, '\n');
    if (
      [...normalized].some(
        (char) => char < ' ' && char !== '\t' && char !== '\n',
      )
    )
      throw new Error(
        'A record contains control characters that GEDCOM cannot represent.',
      );
    const [first, ...rest] = normalized
      .split('\n')
      .map((part) => part.replace(/^@/u, '@@'));
    output.push(`${level} ${tag}${first ? ' ' + first : ''}`);
    for (const part of rest)
      output.push(`${level + 1} CONT${part ? ' ' + part : ''}`);
  }
  function optional(level: number, tag: string, value: string) {
    if (value) line(level, tag, value);
  }
  function refs(level: number, citations: Citation[]) {
    for (const cite of citations) {
      const source = sources.get(cite.source);
      if (!source) continue;
      output.push(`${level} SOUR ${source}`);
      optional(level + 1, 'PAGE', cite.page);
      optional(level + 1, 'NOTE', cite.notes);
    }
  }
  function link(person: string, entry: FamilyLink) {
    const entries = families.get(person) ?? [];
    entries.push(entry);
    families.set(person, entries);
  }
  let familyCount = 0;
  for (const partner of data.partners) {
    const family = `@F${++familyCount}@`;
    familyRows.push(
      `0 ${family} FAM`,
      `1 HUSB ${people.get(partner.a)}`,
      `1 WIFE ${people.get(partner.b)}`,
    );
    link(partner.a, { family, child: false });
    link(partner.b, { family, child: false });
    line(1, '_FR_PARTNER', partner.kind);
    line(1, '_FR_STATUS', partner.status);
    if (partner.kind === 'marriage') {
      line(1, 'MARR', 'Y');
      optional(2, 'DATE', formatDate(partner.start));
      line(2, '_FR_VITAL', 'Y');
    } else optional(1, '_FR_START', formatDate(partner.start));
    optional(1, '_FR_END', formatDate(partner.end));
    optional(1, 'NOTE', partner.notes);
    refs(1, partner.citations);
  }
  for (const parent of data.parents) {
    const family = `@F${++familyCount}@`;
    familyRows.push(
      `0 ${family} FAM`,
      `1 HUSB ${people.get(parent.parent)}`,
      `1 CHIL ${people.get(parent.child)}`,
    );
    link(parent.parent, { family, child: false });
    const pedigree = (
      { biological: 'BIRTH', adoptive: 'ADOPTED', foster: 'FOSTER' } as Record<
        string,
        string
      >
    )[parent.kind];
    link(parent.child, { family, child: true, pedigree });
    line(1, '_FR_PARENT', parent.kind);
    optional(1, 'NOTE', parent.notes);
    refs(1, parent.citations);
  }
  const eventsByPerson = new Map<string, Transfer['events']>();
  for (const event of data.events) {
    const id = event.people[0];
    const list = eventsByPerson.get(id) ?? [];
    list.push(event);
    eventsByPerson.set(id, list);
  }
  output = rows;
  for (const person of data.people) {
    rows.push(`0 ${people.get(person.ref)} INDI`);
    const parts = person.surname
      ? `${nameText(person.given)} /${nameText(person.surname)}/`.trim()
      : nameText(person.name);
    line(1, 'NAME', parts);
    if (
      person.name !==
        [person.given, person.surname].filter(Boolean).join(' ') &&
      person.name !== parts
    )
      line(1, '_FR_NAME', person.name);
    for (const alias of person.aliases) line(1, 'NAME', nameText(alias));
    if (person.status === 'living') line(1, '_FR_LIVING', 'living');
    optional(1, 'NOTE', person.notes);
    optional(1, '_FR_BIO', person.biography ?? '');
    for (const [tag, date, place] of [
      ['BIRT', person.birth, person.birthPlace],
      ['DEAT', person.death, person.deathPlace],
    ] as const) {
      if (
        date.date ||
        place ||
        (tag === 'DEAT' && person.status === 'deceased')
      ) {
        line(1, tag, 'Y');
        optional(2, 'DATE', formatDate(date));
        optional(2, 'PLAC', place);
        line(2, '_FR_VITAL', 'Y');
      }
    }
    refs(1, person.citations);
    for (const entry of families.get(person.ref) ?? []) {
      rows.push(`1 ${entry.child ? 'FAMC' : 'FAMS'} ${entry.family}`);
      if (entry.pedigree) line(2, 'PEDI', entry.pedigree);
    }
    for (const event of eventsByPerson.get(person.ref) ?? []) {
      line(1, 'EVEN');
      line(2, 'TYPE', event.title);
      line(
        2,
        '_FR_TYPE',
        timelineKinds.includes(event.type) ? event.type : 'custom',
      );
      optional(2, 'DATE', formatDate(event.when));
      optional(2, 'PLAC', event.place);
      optional(2, 'NOTE', event.notes);
      for (const participant of event.people.slice(1))
        rows.push(`2 _FR_PART ${people.get(participant)}`);
      refs(2, event.citations);
    }
  }
  rows.push(...familyRows);
  for (const source of data.sources) {
    rows.push(`0 ${sources.get(source.ref)} SOUR`);
    line(1, 'TITL', source.title);
    optional(1, '_FR_URL', source.url);
    optional(1, 'NOTE', source.notes);
  }
  rows.push('0 TRLR');
  // A single GEDCOM file must fit the supported parser limits.
  if (rows.length > 30000 || rows.some((row) => row.length > 12000))
    throw new Error('This export exceeds the GEDCOM line limit.');
  return rows.join('\r\n') + '\r\n';
}
