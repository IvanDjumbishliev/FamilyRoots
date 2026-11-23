export const maxBytes = 1024 * 1024;
export const maxPeople = 500;
export const maxRecords = 4000;

export type HistoricalDate = {
  date: string | null;
  precision: 'unknown' | 'year' | 'month' | 'day';
  approximate: boolean;
};
export type Citation = { source: string; page: string; notes: string };
export type Person = {
  ref: string;
  name: string;
  given: string;
  surname: string;
  aliases: string[];
  status: 'unknown' | 'living' | 'deceased';
  birth: HistoricalDate;
  death: HistoricalDate;
  birthPlace: string;
  deathPlace: string;
  notes: string;
  biography?: string;
  citations: Citation[];
};
export type Parent = {
  parent: string;
  child: string;
  kind: string;
  notes: string;
  citations: Citation[];
};
export type Partner = {
  a: string;
  b: string;
  kind: string;
  status: string;
  start: HistoricalDate;
  end: HistoricalDate;
  notes: string;
  citations: Citation[];
};
export type Event = {
  people: string[];
  type: string;
  title: string;
  when: HistoricalDate;
  place: string;
  notes: string;
  citations: Citation[];
};
export type Source = { ref: string; title: string; url: string; notes: string };
export type Transfer = {
  people: Person[];
  parents: Parent[];
  partners: Partner[];
  events: Event[];
  sources: Source[];
};
export type Warning = { line: number; message: string; original: string };
export const emptyDate: HistoricalDate = {
  date: null,
  precision: 'unknown',
  approximate: false,
};
export const months = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];
export const eventTags: Record<string, string> = {
  BIRT: 'birth',
  DEAT: 'death',
  MARR: 'partnership',
  DIV: 'custom',
  IMMI: 'migration',
  EMIG: 'migration',
  GRAD: 'education',
  EDUC: 'education',
  OCCU: 'occupation',
  RESI: 'residence',
  EVEN: 'custom',
};
export const eventLabels: Record<string, string> = {
  BIRT: 'Birth',
  DEAT: 'Death',
  MARR: 'Marriage',
  DIV: 'Divorce',
  IMMI: 'Immigration',
  EMIG: 'Emigration',
  GRAD: 'Graduation',
  EDUC: 'Education',
  OCCU: 'Occupation',
  RESI: 'Residence',
  EVEN: 'Family milestone',
};
export const parentKinds = [
  'biological',
  'adoptive',
  'step',
  'foster',
  'guardian',
  'other',
];
export const partnerKinds = [
  'marriage',
  'civil_union',
  'domestic_partnership',
  'other',
];
export const timelineKinds = [
  'birth',
  'death',
  'partnership',
  'migration',
  'education',
  'occupation',
  'military_service',
  'residence',
  'custom',
];
export const cleanName = (name: string) =>
  name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
