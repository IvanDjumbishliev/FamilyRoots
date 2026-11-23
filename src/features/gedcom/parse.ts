import {
  emptyDate,
  eventLabels,
  eventTags,
  maxBytes,
  maxPeople,
  maxRecords,
  months,
  parentKinds,
  partnerKinds,
  timelineKinds,
  type Citation,
  type Event,
  type HistoricalDate,
  type Transfer,
  type Warning,
} from './model';

type Line = {
  number: number;
  tag: string;
  ref?: string;
  value: string;
  raw: string;
  children: Line[];
};

function structure(input: string) {
  if (
    input.length > maxBytes ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/u.test(input)
  )
    throw new Error('Use a plain UTF-8 GEDCOM file up to 1 MiB.');
  const roots: Line[] = [];
  const stack: Line[] = [];
  const lines = input.replace(/^\uFEFF/u, '').split(/\r\n|\n|\r/u);
  if (lines.length > 30000)
    throw new Error('The file has more than 30,000 lines.');
  for (const [index, raw] of lines.entries()) {
    if (!raw.trim()) continue;
    const number = index + 1;
    const match =
      /^(0|[1-9]\d?) (?:(@[A-Za-z0-9_][A-Za-z0-9_.:-]{0,78}@) )?([A-Z_][A-Z0-9_]*)(?: (.*))?$/u.exec(
        raw,
      );
    if (!match || raw.length > 12000)
      throw new Error(`Line ${number} is malformed or exceeds the line limit.`);
    const [, levelText, ref, tag, value = ''] = match;
    const level = Number(levelText);
    if (level > 16 || level > stack.length || (ref && level !== 0))
      throw new Error(`Invalid nesting or cross-reference on line ${number}.`);
    const node = { number, tag, ref, value, raw, children: [] };
    if (!level) roots.push(node);
    else stack[level - 1].children.push(node);
    stack.length = level;
    stack.push(node);
  }
  const [head] = roots;
  const trailer = roots.at(-1);
  if (
    head?.tag !== 'HEAD' ||
    head.ref ||
    head.value ||
    trailer?.tag !== 'TRLR' ||
    trailer.ref ||
    trailer.value ||
    trailer.children.length ||
    roots
      .slice(1, -1)
      .some((line) => line.tag === 'HEAD' || line.tag === 'TRLR')
  )
    throw new Error(
      'Expected one HEAD record at the start and one TRLR record at the end.',
    );
  return roots;
}

export function parseGedcom(input: string): {
  data: Transfer;
  warnings: Warning[];
  version: string;
} {
  const roots = structure(input);
  const seen = new Set<Line>();
  function all(node: Line, tag: string) {
    const matches = node.children.filter((child) => child.tag === tag);
    for (const child of matches) seen.add(child);
    return matches;
  }
  function first(node: Line, tag: string) {
    const child = node.children.find((item) => item.tag === tag);
    if (child) seen.add(child);
    return child;
  }
  const value = (node: Line, tag: string) => {
    const child = first(node, tag);
    return child ? text(child).trim() : '';
  };
  const warnings: Warning[] = [];
  function warning(line: Line, message: string) {
    warnings.push({ line: line.number, message, original: line.raw });
  }
  const header = roots[0];
  const gedc = first(header, 'GEDC');
  const version = gedc ? value(gedc, 'VERS') : '';
  if (gedc && version === '5.5.1') first(gedc, 'FORM');
  if (!/^(5\.5\.1|7\.0(?:\.\d+)?)$/u.test(version))
    throw new Error('Supported versions are GEDCOM 5.5.1 and 7.0.');
  const encoding = value(header, 'CHAR');
  if (
    (encoding && !['UTF-8', 'ASCII'].includes(encoding)) ||
    (version === '5.5.1' && !encoding)
  )
    throw new Error('Save the GEDCOM file using UTF-8 or ASCII encoding.');
  const schema = first(header, 'SCHMA');
  if (schema)
    for (const tag of schema.children) {
      if (
        tag.tag === 'TAG' &&
        /^_FR_[A-Z]+ urn:familyroots:gedcom:/u.test(tag.value)
      )
        seen.add(tag);
    }
  const producer = first(header, 'SOUR');
  if (producer) {
    first(producer, 'VERS');
    first(producer, 'NAME');
  }
  const records = new Map<string, Line>();
  const data: Transfer = {
    people: [],
    parents: [],
    partners: [],
    events: [],
    sources: [],
  };
  const rootsByTag = (tag: string) => roots.filter((node) => node.tag === tag);
  for (const node of roots.slice(1, -1)) {
    if (!node.ref && ['INDI', 'FAM', 'SOUR'].includes(node.tag)) {
      if (version === '5.5.1')
        throw new Error(`Missing record identifier on line ${node.number}.`);
      node.ref = `line:${node.number}`;
    }
    if (node.ref) {
      if (node.ref === '@VOID@')
        throw new Error(`Reserved identifier on line ${node.number}.`);
      if (records.has(node.ref))
        throw new Error(`Duplicate record identifier on line ${node.number}.`);
      records.set(node.ref, node);
    }
  }
  if (roots.length > maxRecords || rootsByTag('INDI').length > maxPeople)
    throw new Error('Import at most 500 people and 4,000 records per file.');
  function target(node: Line, tags: string[]) {
    if (node.value.trim() === '@VOID@') {
      warning(node, 'This reference has no target and was omitted.');
      return undefined;
    }
    const record = records.get(node.value.trim());
    if (!record || !tags.includes(record.tag))
      throw new Error(
        `Line ${node.number} references a missing or incompatible record.`,
      );
    return record;
  }
  function text(node: Line) {
    const decoded = (input: string) => input.replace(/^@@/u, '@');
    const continuation = node.children.filter(
      (child) => child.tag === 'CONT' || child.tag === 'CONC',
    );
    for (const child of continuation) seen.add(child);
    return (
      decoded(node.value) +
      continuation
        .map(
          (child) => (child.tag === 'CONT' ? '\n' : '') + decoded(child.value),
        )
        .join('')
    );
  }
  function notes(node: Line) {
    return node.children
      .filter((child) => child.tag === 'NOTE' || child.tag === 'SNOTE')
      .map((child) => {
        seen.add(child);
        if (child.tag === 'SNOTE' || /^@[^@]+@$/u.test(child.value)) {
          const note = target(child, ['NOTE', 'SNOTE']);
          if (!note) return '';
          seen.add(note);
          return text(note);
        }
        return text(child);
      })
      .join('\n');
  }
  function citations(node: Line): Citation[] {
    return all(node, 'SOUR').flatMap((source) => {
      if (!source.value.startsWith('@')) {
        warning(source, 'Inline source descriptions are unsupported.');
        return [];
      }
      const record = target(source, ['SOUR']);
      if (!record) return [];
      return [
        {
          source: record.ref!,
          page: value(source, 'PAGE'),
          notes: notes(source),
        },
      ];
    });
  }
  function date(node?: Line): HistoricalDate {
    if (!node || !node.value.trim()) return emptyDate;
    const parsed =
      /^(?:(ABT|CAL|EST) )?(?:(?:(\d{1,2}) )?([A-Z]{3}) )?(\d{1,4})$/u.exec(
        node.value.trim().toUpperCase(),
      );
    if (parsed) {
      const [, approximation, day, month, year] = parsed;
      const monthIndex = month ? months.indexOf(month) : 0;
      const iso = `${year.padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${(day ?? '1').padStart(2, '0')}`;
      const timestamp = new Date(iso + 'T00:00:00Z');
      if (
        Number(year) &&
        monthIndex >= 0 &&
        !Number.isNaN(timestamp.valueOf()) &&
        timestamp.toISOString().startsWith(iso)
      )
        return {
          date: iso,
          precision: day ? 'day' : month ? 'month' : 'year',
          approximate: Boolean(approximation),
        };
    }
    warning(node, 'Unsupported or invalid date retained in this report.');
    return emptyDate;
  }
  const nameParts = (name: string) => {
    const [given = '', surname = '', suffix = ''] = name.split('/');
    return {
      name: [given, surname, suffix]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' '),
      given: given.trim(),
      surname: surname.trim(),
    };
  };
  function max(value: string, size: number, node: Line, field: string) {
    if ([...value].length > size)
      throw new Error(
        `${field} on line ${node.number} exceeds ${size} characters.`,
      );
    return value;
  }
  function addEvent(node: Line, people: string[], refs = citations(node)) {
    const name = value(node, 'TYPE');
    const override = value(node, '_FR_TYPE');
    if (override && !timelineKinds.includes(override))
      warning(node, 'Unsupported FamilyRoots event type.');
    const participants = all(node, '_FR_PART').flatMap(
      (part) => target(part, ['INDI'])?.ref ?? [],
    );
    const event: Event = {
      people: [...new Set([...people, ...participants])],
      type: timelineKinds.includes(override) ? override : eventTags[node.tag],
      title: max(
        name ||
          (node.value && node.value !== 'Y'
            ? node.value
            : eventLabels[node.tag]),
        160,
        node,
        'Event title',
      ),
      when: date(first(node, 'DATE')),
      place: max(value(node, 'PLAC'), 240, node, 'Place'),
      notes: max(notes(node), 6000, node, 'Event notes'),
      citations: refs,
    };
    if (event.people.length) data.events.push(event);
    else warning(node, 'Event has no supported participants.');
    return event;
  }
  const individuals = rootsByTag('INDI');
  const families = rootsByTag('FAM');
  const pedigrees = new Map<string, Map<string, string>>();
  const adoption = new Map<string, Map<string, string>>();
  const childFamilies = new Map<string, Set<string>>();
  const disputed = new Map<string, Set<string>>();
  for (const node of individuals) {
    seen.add(node);
    const names = all(node, 'NAME').map((line) => {
      const parsed = nameParts(text(line));
      return {
        ...parsed,
        given: value(line, 'GIVN') || parsed.given,
        surname: value(line, 'SURN') || parsed.surname,
      };
    });
    const identity = names[0] ?? { name: '', given: '', surname: '' };
    const customName = value(node, '_FR_NAME');
    const biography = max(value(node, '_FR_BIO'), 10000, node, 'Biography');
    const birth = first(node, 'BIRT');
    const deathNode = first(node, 'DEAT');
    const death = deathNode?.value.trim() === 'N' ? undefined : deathNode;
    const status = value(node, '_FR_LIVING');
    const refs = citations(node);
    for (const event of node.children.filter((item) => eventTags[item.tag])) {
      seen.add(event);
      if (event === deathNode && !death) continue;
      const detail = addEvent(event, [node.ref!]);
      if (
        (event === birth || event === death) &&
        value(event, '_FR_VITAL') === 'Y'
      )
        data.events.pop();
      else if (event === birth || event === death) {
        // Birth/death fields and their evidence can also be found on the person.
        if (detail.citations.length) refs.push(...detail.citations);
      }
    }
    const familyKinds = new Map<string, string>();
    for (const link of all(node, 'FAMC')) {
      const family = target(link, ['FAM']);
      if (!family) continue;
      const status = first(link, 'STAT');
      if (status && ['DISPROVEN', 'CHALLENGED'].includes(status.value.trim())) {
        const excluded = disputed.get(family.ref!) ?? new Set<string>();
        excluded.add(node.ref!);
        disputed.set(family.ref!, excluded);
        warning(status, 'A challenged or disproven parent link was omitted.');
        continue;
      }
      if (status && status.value.trim() !== 'PROVEN')
        warning(status, 'Unsupported pedigree status.');
      const ids = childFamilies.get(family.ref!) ?? new Set<string>();
      ids.add(node.ref!);
      childFamilies.set(family.ref!, ids);
      const pedigree = value(link, 'PEDI').toUpperCase();
      familyKinds.set(
        family.ref!,
        (
          {
            BIRTH: 'biological',
            ADOPTED: 'adoptive',
            FOSTER: 'foster',
          } as Record<string, string>
        )[pedigree] ?? 'other',
      );
      if (pedigree && !['BIRTH', 'ADOPTED', 'FOSTER'].includes(pedigree))
        warning(
          link,
          'Unmapped pedigree imported as an unspecified parent link.',
        );
    }
    pedigrees.set(node.ref!, familyKinds);
    for (const link of all(node, 'FAMS')) target(link, ['FAM']);
    for (const event of all(node, 'ADOP')) {
      const link = first(event, 'FAMC');
      let selection = link ? value(link, 'ADOP') : '';
      const family = link ? target(link, ['FAM']) : undefined;
      if (family && !selection) {
        const roles = family.children.filter(
          (child) =>
            ['HUSB', 'WIFE'].includes(child.tag) &&
            child.value.trim() !== '@VOID@',
        );
        if (roles.length === 1) selection = roles[0].tag;
      }
      if (family && ['HUSB', 'WIFE', 'BOTH'].includes(selection)) {
        const adoptionByFamily =
          adoption.get(node.ref!) ?? new Map<string, string>();
        adoptionByFamily.set(family.ref!, selection);
        adoption.set(node.ref!, adoptionByFamily);
        const ids = childFamilies.get(family.ref!) ?? new Set<string>();
        ids.add(node.ref!);
        childFamilies.set(family.ref!, ids);
        const adoptionEvent = addEvent(
          { ...event, tag: 'EVEN', value: 'Adoption' },
          [node.ref!],
        );
        if (
          !adoptionEvent.when.date &&
          !adoptionEvent.notes &&
          !adoptionEvent.place &&
          !adoptionEvent.citations.length
        )
          data.events.pop();
      } else
        warning(
          event,
          'Adoption without named adoptive parent roles was omitted; use an explicit pedigree link.',
        );
    }
    const birthDate = birth ? date(first(birth, 'DATE')) : emptyDate;
    const deathDate = death ? date(first(death, 'DATE')) : emptyDate;
    const aliases = names
      .slice(1)
      .map((name) => max(name.name, 160, node, 'Alternate name'))
      .filter(Boolean);
    if (aliases.length > 20)
      throw new Error(`Too many alternate names on line ${node.number}.`);
    if (!identity.name)
      warning(node, 'Missing name; a placeholder will be created.');
    data.people.push({
      ref: node.ref!,
      name: max(
        customName || identity.name || 'Unknown person',
        160,
        node,
        'Name',
      ),
      given: max(identity.given, 160, node, 'Given names'),
      surname: max(identity.surname, 160, node, 'Surname'),
      aliases,
      status: death
        ? 'deceased'
        : status === 'living' || status === 'deceased'
          ? status
          : 'unknown',
      birth: birthDate,
      death: deathDate,
      birthPlace: birth
        ? max(value(birth, 'PLAC'), 240, birth, 'Birth place')
        : '',
      deathPlace: death
        ? max(value(death, 'PLAC'), 240, death, 'Death place')
        : '',
      notes: max(notes(node), 10000, node, 'Person notes'),
      biography,
      citations: refs,
    });
  }
  for (const node of families) {
    seen.add(node);
    const adults = ['HUSB', 'WIFE'].flatMap((role) =>
      all(node, role).flatMap((line) => {
        const ref = target(line, ['INDI'])?.ref;
        return ref ? [{ role, ref }] : [];
      }),
    );
    if (
      adults.length > 2 ||
      new Set(adults.map(({ role }) => role)).size !== adults.length
    )
      throw new Error(
        `Multiple partners in the same family slot on line ${node.number}.`,
      );
    const children = new Set([
      ...all(node, 'CHIL').flatMap((line) => target(line, ['INDI'])?.ref ?? []),
      ...(childFamilies.get(node.ref!) ?? []),
    ]);
    const refs = citations(node);
    const familyNotes = max(notes(node), 10000, node, 'Family notes');
    const rawParent = value(node, '_FR_PARENT');
    const rawPartner = value(node, '_FR_PARTNER');
    const marriage = first(node, 'MARR');
    const divorce = first(node, 'DIV');
    if (rawParent && !parentKinds.includes(rawParent))
      warning(node, 'Unrecognized parent kind treated as unspecified.');
    if (rawPartner && !partnerKinds.includes(rawPartner))
      warning(node, 'Unrecognized partnership kind treated as other.');
    if (adults.length === 2) {
      const status = value(node, '_FR_STATUS');
      data.partners.push({
        a: adults[0].ref,
        b: adults[1].ref,
        kind: partnerKinds.includes(rawPartner)
          ? rawPartner
          : marriage
            ? 'marriage'
            : 'other',
        status:
          divorce || status === 'former'
            ? 'former'
            : status === 'current'
              ? 'current'
              : 'unknown',
        start: date(
          first(node, '_FR_START') ?? (marriage && first(marriage, 'DATE')),
        ),
        end: date(
          first(node, '_FR_END') ?? (divorce && first(divorce, 'DATE')),
        ),
        notes: familyNotes,
        citations: refs,
      });
    }
    if (!adults.length && children.size)
      warning(
        node,
        'Family has no known parents; no parent links can be created.',
      );
    for (const child of children) {
      if (disputed.get(node.ref!)?.has(child)) continue;
      for (const adult of adults) {
        const explicit = adoption.get(child)?.get(node.ref!);
        const familyKind = pedigrees.get(child)?.get(node.ref!) ?? 'other';
        const kind = parentKinds.includes(rawParent)
          ? rawParent
          : explicit
            ? explicit === 'BOTH' || explicit === adult.role
              ? 'adoptive'
              : familyKind === 'adoptive'
                ? 'other'
                : familyKind
            : familyKind;
        data.parents.push({
          parent: adult.ref,
          child,
          kind,
          notes: adults.length === 1 ? familyNotes : '',
          citations: adults.length === 1 ? refs : [],
        });
      }
    }
    if (
      adults.length < 2 &&
      (!adults.length || !children.size) &&
      (familyNotes || refs.length)
    )
      warning(
        node,
        'Family notes or citations have no supported relationship target.',
      );
    for (const event of node.children.filter((item) => eventTags[item.tag])) {
      seen.add(event);
      if (value(event, '_FR_VITAL') === 'Y') continue;
      addEvent(
        event,
        adults.map(({ ref }) => ref),
      );
    }
  }
  for (const node of rootsByTag('SOUR')) {
    seen.add(node);
    const title = value(node, 'TITL');
    if (!title)
      warning(node, 'Missing source title; a placeholder will be created.');
    const url = max(value(node, '_FR_URL'), 1000, node, 'Source URL');
    if (url && !/^https?:\/\/[^\s]+$/u.test(url))
      warning(first(node, '_FR_URL')!, 'Source URL must use HTTP or HTTPS.');
    data.sources.push({
      ref: node.ref!,
      title: max(title || 'Untitled source', 255, node, 'Source title'),
      url: /^https?:\/\/[^\s]+$/u.test(url) ? url : '',
      notes: max(notes(node), 10000, node, 'Source notes'),
    });
  }
  if (!individuals.length)
    throw new Error('The file has no individual (INDI) records.');
  function report(node: Line) {
    if (!seen.has(node))
      warning(node, `Unsupported or extra ${node.tag} field.`);
    for (const child of node.children) report(child);
  }
  seen.add(header);
  seen.add(roots.at(-1)!);
  roots.forEach(report);
  if (
    data.parents.length +
      data.partners.length +
      data.events.length +
      data.sources.length >
    maxRecords
  )
    throw new Error('The file creates more than 4,000 related records.');
  return {
    data,
    warnings: [
      ...new Map(
        warnings.map((issue) => [issue.line + issue.message, issue]),
      ).values(),
    ].sort((a, b) => a.line - b.line),
    version,
  };
}
