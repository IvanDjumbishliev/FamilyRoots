export const sectionKeys = [
  'cover',
  'title',
  'copyright',
  'dedication',
  'contents',
  'introduction',
  'tree',
  'generations',
  'biographies',
  'events',
  'gallery',
  'timeline',
  'sources',
  'closing',
] as const;
export type SectionKey = (typeof sectionKeys)[number];
export type Language = 'en' | 'es' | 'bg';
export type Theme = 'forest' | 'ink' | 'sepia';
export type BookSettings = {
  title: string;
  subtitle: string;
  author: string;
  copyright: string;
  dedication: string;
  language: Language;
  theme: Theme;
  branch: string | null;
  sample: boolean;
  privacy: 'private' | 'full';
  consent: boolean;
  biographies: string[];
  events: string[];
  media: string[];
};
export type Section = {
  key: SectionKey;
  title: string;
  paragraphs: string[];
  edit?: string;
  mediaIds?: string[];
};
type Person = {
  id: string;
  name: string;
  verified: boolean;
  birth: string | null;
  death: string | null;
  birthPrecision: string;
  deathPrecision: string;
  birthApproximate: boolean;
  deathApproximate: boolean;
  birthPlace: string | null;
  deathPlace: string | null;
  occupation: string | null;
  biography: string | null;
};
type Event = {
  id: string;
  title: string | null;
  type: string;
  day: string | null;
  precision: string;
  approximate: boolean;
  people: string[];
};
type Source = {
  id: string;
  personId: string | null;
  eventId: string | null;
  title: string | null;
  locator: string | null;
  url: string | null;
};
export type BookMedia = {
  id: string;
  title: string;
  credit: string | null;
  mime: string;
  path: string | null;
  description: string | null;
};
export type BookContext = {
  people: Person[];
  edges: { parent: string; child: string; kind: string }[];
  events: Event[];
  sources: Source[];
  media: BookMedia[];
};

const headings: Record<Language, readonly string[]> = {
  en: [
    'Cover',
    'Title page',
    'Copyright and attribution',
    'Dedication',
    'Contents',
    'Family introduction',
    'Family tree overview',
    'Generational chapters',
    'Individual biographies',
    'Important family events',
    'Photographs and documents',
    'Historical timeline',
    'Sources and references',
    'Closing chapter',
  ],
  es: [
    'Cubierta',
    'Portada',
    'Derechos y atribución',
    'Dedicatoria',
    'Índice',
    'Introducción familiar',
    'Árbol familiar',
    'Capítulos generacionales',
    'Biografías',
    'Eventos familiares',
    'Fotografías y documentos',
    'Cronología',
    'Fuentes y referencias',
    'Capítulo final',
  ],
  bg: [
    'Корица',
    'Заглавна страница',
    'Авторство и права',
    'Посвещение',
    'Съдържание',
    'Въведение',
    'Родословно дърво',
    'Поколения',
    'Биографии',
    'Семейни събития',
    'Снимки и документи',
    'Хронология',
    'Източници',
    'Заключителна глава',
  ],
};

const words = {
  en: {
    account:
      'This account draws on the selected family tree. Verified facts are given with references when available.',
    sample:
      'This is a fictional sample. Its names, dates, records, and relationships illustrate the format.',
    privacy:
      'This edition omits living and unknown-status profiles, sensitive details, media, and source titles.',
    credits: 'Author or family attribution',
    rights:
      'Notices are supplied by the contributor. This publication makes no determination about ownership or registration.',
    material:
      'Editorial additions and family material come from contributors. Media credits are recorded as supplied. Automated text is assembled from tree records without generative AI.',
    missing: 'No eligible entries were selected for this section.',
    noDedication: 'A dedication can be added in the draft editor.',
    closing:
      'Keep original records, record uncertainties, and add new evidence as it becomes available.',
    total: 'Included profiles',
    generation: 'Generation',
    birth: 'Birth',
    death: 'Death',
    occupation: 'Occupation',
    unknown: 'Unknown',
    unverified:
      'Profile information awaits verification; biographical facts are omitted.',
    verifiedLinks: 'Verified biological and adoptive parent links',
    parent: 'parent',
    adoptive: 'adoptive',
    biological: 'biological',
    source: 'Private tree source',
    event: 'Family milestone',
    file: 'Archive document reference',
    credit: 'Media credit',
    noCredit: 'Rights or credit not recorded',
    notes: 'Contributor biography (as recorded)',
    profile: 'Family tree profile',
    verified: 'verified',
    pending: 'unverified',
  },
  es: {
    account:
      'Este relato se basa en el árbol familiar seleccionado. Los hechos verificados se acompañan de referencias cuando existen.',
    sample:
      'Este es un ejemplo ficticio. Sus nombres, fechas, documentos y vínculos ilustran el formato.',
    privacy:
      'Esta edición omite perfiles vivos o de estado desconocido, detalles privados, archivos y títulos de fuentes.',
    credits: 'Autor o atribución familiar',
    rights:
      'Los avisos proceden de la persona colaboradora. Esta publicación no determina la titularidad ni el registro de derechos.',
    material:
      'Las aportaciones editoriales y familiares provienen de sus colaboradores. Los créditos de archivos se incluyen según lo indicado. El texto automatizado se compone a partir del árbol sin IA generativa.',
    missing: 'No se seleccionaron entradas aptas para esta sección.',
    noDedication: 'Puede añadir una dedicatoria en el editor.',
    closing:
      'Conserve los registros originales, señale las dudas y añada nueva evidencia cuando esté disponible.',
    total: 'Perfiles incluidos',
    generation: 'Generación',
    birth: 'Nacimiento',
    death: 'Fallecimiento',
    occupation: 'Profesión',
    unknown: 'Desconocido',
    unverified:
      'El perfil está pendiente de verificación y se omiten sus datos biográficos.',
    verifiedLinks: 'Vínculos verificados de filiación biológica o adoptiva',
    parent: 'progenitor',
    adoptive: 'adoptivo',
    biological: 'biológico',
    source: 'Fuente privada del árbol',
    event: 'Hito familiar',
    file: 'Referencia de archivo',
    credit: 'Crédito',
    noCredit: 'Derechos o crédito sin indicar',
    notes: 'Biografía aportada (texto original)',
    profile: 'Perfil del árbol familiar',
    verified: 'verificado',
    pending: 'sin verificar',
  },
  bg: {
    account:
      'Този разказ се основава на избраното родословно дърво. Към потвърдените факти са посочени наличните източници.',
    sample:
      'Това е измислен пример. Имената, датите, записите и връзките илюстрират формата.',
    privacy:
      'Това издание пропуска живи хора и хора с неизвестен статус, лични данни, файлове и заглавия на източници.',
    credits: 'Автор или семейство',
    rights:
      'Бележките са предоставени от съставителя. Изданието не определя собственост или регистрация на права.',
    material:
      'Семейните материали и редакциите са предоставени от съставителите. Посоченото авторство на файловете се запазва. Автоматичният текст се съставя от записите без генеративен ИИ.',
    missing: 'Няма подходящи записи за този раздел.',
    noDedication: 'Посвещение може да се добави в редактора.',
    closing:
      'Пазете оригиналните документи, отбелязвайте неизвестното и добавяйте нови източници.',
    total: 'Включени профили',
    generation: 'Поколение',
    birth: 'Раждане',
    death: 'Смърт',
    occupation: 'Професия',
    unknown: 'Неизвестно',
    unverified:
      'Профилът не е потвърден и биографичните подробности са пропуснати.',
    verifiedLinks: 'Потвърдени биологични и осиновителни връзки',
    parent: 'родител',
    adoptive: 'осиновител',
    biological: 'биологичен',
    source: 'Личен източник в дървото',
    event: 'Семейно събитие',
    file: 'Архивна справка',
    credit: 'Авторство',
    noCredit: 'Няма посочени права или авторство',
    notes: 'Предоставена биография (оригинален текст)',
    profile: 'Профил в родословното дърво',
    verified: 'потвърден',
    pending: 'непотвърден',
  },
} as const;

export function outline(language: Language) {
  return sectionKeys.map((key, index) => ({
    key,
    title: headings[language][index],
  }));
}

function dateLabel(
  day: string | null,
  precision: string,
  approximate: boolean,
  language: Language,
) {
  const value =
    day && precision !== 'unknown'
      ? day.slice(0, precision === 'year' ? 4 : precision === 'month' ? 7 : 10)
      : '';
  return value ? (approximate ? '≈ ' : '') + value : words[language].unknown;
}

function generationLevels(data: BookContext) {
  const levels = new Map(data.people.map(({ id }) => [id, 1]));
  const pending = new Map(data.people.map(({ id }) => [id, 0]));
  const children = new Map<string, string[]>();
  for (const { parent, child } of data.edges) {
    if (!levels.has(parent) || !levels.has(child)) continue;
    pending.set(child, (pending.get(child) ?? 0) + 1);
    children.set(parent, [...(children.get(parent) ?? []), child]);
  }
  const queue = [...pending].filter(([, count]) => !count).map(([id]) => id);
  for (const parent of queue)
    for (const child of children.get(parent) ?? []) {
      levels.set(
        child,
        Math.max(levels.get(child) ?? 1, (levels.get(parent) ?? 1) + 1),
      );
      const left = (pending.get(child) ?? 1) - 1;
      pending.set(child, left);
      if (!left) queue.push(child);
    }
  return levels;
}

export function buildSections(
  settings: BookSettings,
  data: BookContext,
): Section[] {
  const w = words[settings.language];
  const names = new Map(
    data.people.map((item, index) => [
      item.id,
      { name: item.name, ref: 'P' + (index + 1) },
    ]),
  );
  const links = generationLevels(data);
  const generations = new Map<number, string[]>();
  for (const [id, level] of links)
    generations.set(level, [
      ...(generations.get(level) ?? []),
      names.get(id)!.name,
    ]);
  const references = data.sources.map((source, index) => ({
    ...source,
    ref: 'R' + (index + 1),
  }));
  const cite = (personId?: string, eventId?: string) =>
    references
      .filter((r) =>
        personId ? r.personId === personId : r.eventId === eventId,
      )
      .map((r) => r.ref);
  const showCite = (refs: string[]) =>
    refs.length ? ' [' + refs.join(', ') + ']' : '';
  const biographies = new Set(
    settings.sample ? data.people.map((p) => p.id) : settings.biographies,
  );
  const events = data.events.map((e, index) => ({
    id: e.id,
    label:
      e.title ||
      (
        { birth: w.birth, death: w.death, occupation: w.occupation } as Record<
          string,
          string
        >
      )[e.type] ||
      w.event,
    date: dateLabel(e.day, e.precision, e.approximate, settings.language),
    people: e.people,
    ref: 'E' + (index + 1),
  }));
  const content: Record<SectionKey, string[]> = {
    cover: [settings.title, settings.subtitle, settings.author].filter(Boolean),
    title: [settings.title, settings.subtitle, settings.author].filter(Boolean),
    copyright: [
      settings.author && w.credits + ' · ' + settings.author,
      settings.copyright,
      w.rights,
      w.material,
    ].filter(Boolean),
    dedication: [settings.dedication || w.noDedication],
    contents: headings[settings.language].slice(5) as string[],
    introduction: [
      settings.sample ? w.sample : w.account,
      ...(settings.privacy === 'private' ? [w.privacy] : []),
    ],
    tree: [
      w.total + ' · ' + data.people.length,
      w.verifiedLinks,
      ...data.edges.map(
        (edge) =>
          `${names.get(edge.parent)?.name} → ${names.get(edge.child)?.name} · ${edge.kind === 'adoptive' ? w.adoptive : w.biological} ${w.parent}`,
      ),
    ],
    generations: [...generations]
      .sort(([a], [b]) => a - b)
      .map(
        ([level, group]) =>
          w.generation + ' ' + level + ' · ' + group.join(', '),
      ),
    biographies: data.people
      .filter((p) => biographies.has(p.id))
      .map((p) => {
        const ref = names.get(p.id)!.ref;
        if (!p.verified) return `${p.name} [${ref}]\n${w.unverified}`;
        return [
          `${p.name} [${ref}]${showCite(cite(p.id))}`,
          w.birth +
            ' · ' +
            dateLabel(
              p.birth,
              p.birthPrecision,
              p.birthApproximate,
              settings.language,
            ) +
            (p.birthPlace ? ' · ' + p.birthPlace : ''),
          w.death +
            ' · ' +
            dateLabel(
              p.death,
              p.deathPrecision,
              p.deathApproximate,
              settings.language,
            ) +
            (p.deathPlace ? ' · ' + p.deathPlace : ''),
          p.occupation && w.occupation + ' · ' + p.occupation,
          p.biography && w.notes + ' · ' + p.biography,
        ]
          .filter(Boolean)
          .join('\n');
      }),
    events: events.map(
      (e) =>
        `${e.label} [${e.ref}]${showCite(cite(undefined, e.id))}\n${e.date} · ${e.people.join(', ')}`,
    ),
    gallery: data.media.map((m) =>
      [
        m.title,
        m.description,
        m.mime.startsWith('image/')
          ? w.credit + ' · ' + (m.credit || w.noCredit)
          : w.file + ' · ' + (m.credit || w.noCredit),
      ]
        .filter(Boolean)
        .join('\n'),
    ),
    timeline: events.map(
      (e) =>
        `${e.date} · ${e.label} [${e.ref}]${showCite(cite(undefined, e.id))}`,
    ),
    sources: [
      ...references.map(
        (r) =>
          `[${r.ref}] ${r.title || w.source}` +
          (r.locator ? ' · ' + r.locator : '') +
          (r.url ? '\n' + r.url : ''),
      ),
      ...data.people.map(
        (p) =>
          `[${names.get(p.id)!.ref}] ${w.profile} · ${p.name} · ${p.verified ? w.verified : w.pending}`,
      ),
      ...events.map((e) => `[${e.ref}] ${e.label} · ${e.date}`),
    ],
    closing: [w.closing],
  };
  return outline(settings.language).map(({ key, title }) => ({
    key,
    title,
    paragraphs: content[key].length ? content[key] : [w.missing],
    ...(key === 'gallery' && data.media.length
      ? { mediaIds: data.media.map(({ id }) => id) }
      : {}),
  }));
}

export function sampleContext(redacted: boolean): BookContext {
  const first: Person = {
    id: 'sample-mara',
    name: 'Mara Petrova',
    verified: true,
    birth: '1882-01-01',
    death: '1951-01-01',
    birthPrecision: 'year',
    deathPrecision: 'year',
    birthApproximate: true,
    deathApproximate: false,
    birthPlace: redacted ? null : 'Plovdiv',
    deathPlace: null,
    occupation: redacted ? null : 'Bookbinder',
    biography: null,
  };
  const second: Person = {
    ...first,
    id: 'sample-elena',
    name: 'Elena Petrova',
    birth: '1910-01-01',
    death: '1987-01-01',
    birthApproximate: false,
    birthPlace: null,
    occupation: null,
  };
  return {
    people: [first, second],
    edges: [{ parent: first.id, child: second.id, kind: 'biological' }],
    events: [
      {
        id: 'sample-move',
        title: redacted
          ? null
          : 'Move recorded in the fictional family register',
        type: 'migration',
        day: '1934-01-01',
        precision: 'year',
        approximate: true,
        people: [second.name],
      },
    ],
    sources: [
      {
        id: 'sample-source',
        personId: first.id,
        eventId: null,
        title: redacted ? null : 'Fictional FamilyRoots civil register',
        locator: redacted ? null : 'Sample volume, page 12',
        url: null,
      },
    ],
    media: [],
  };
}
