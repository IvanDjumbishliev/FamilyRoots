import { randomUUID } from 'expo-crypto';
import { useMemo, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { Type } from '@/components/Type';
import { Choices } from '@/features/people/Choices';
import {
  transferError,
  type Candidate,
  type GedcomRepository,
  type ImportSummary,
} from '@/services/gedcomRepository';

import { pickGedcom, saveTransferFile } from './files';
import { cleanName, type Person } from './model';
import { parseGedcom } from './parse';
import { writeGedcom } from './write';

type Preview = ReturnType<typeof parseGedcom> & {
  name: string;
  candidates: Candidate[];
};
const tabs = [
  { value: 'people', label: 'People' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'events', label: 'Events' },
  { value: 'warnings', label: 'Field report' },
] as const;
type Tab = (typeof tabs)[number]['value'];

export function GedcomWorkspace({
  repository,
  tree,
  canImport,
  canExport,
}: {
  repository: GedcomRepository;
  tree: string;
  canImport: boolean;
  canExport: boolean;
}) {
  const [preview, setPreview] = useState<Preview>();
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState(0);
  const [issue, setIssue] = useState('');
  const [exclude, setExclude] = useState<'exclude' | 'include'>('exclude');
  const [exported, setExported] = useState(false);

  async function choose() {
    setBusy(true);
    setIssue('');
    try {
      const file = await pickGedcom();
      if (!file) return;
      const parsed = parseGedcom(file.text);
      setSelection((previous) => previous + 1);
      setPreview({
        ...parsed,
        name: file.name,
        candidates: await repository.candidates(tree),
      });
    } catch (error) {
      setIssue(transferError(error));
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    setIssue('');
    setExported(false);
    try {
      const data = await repository.export(tree, exclude === 'exclude');
      await saveTransferFile('family-tree.ged', writeGedcom(data));
      setExported(true);
    } catch (error) {
      setIssue(transferError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!canImport && !canExport && (
        <Type>
          Editing permission is required to import. Only the tree owner can
          export.
        </Type>
      )}
      {canImport && (
        <Card>
          <Type variant="heading" accessibilityRole="header">
            Import a GEDCOM file
          </Type>
          <Type tone="muted">
            UTF-8 GEDCOM 5.5.1 or 7.0 · Up to 1 MiB and 500 people.
          </Type>
          <Button
            label={busy ? 'Working…' : 'Choose GEDCOM file'}
            disabled={busy || !!preview}
            onPress={() => void choose()}
          />
        </Card>
      )}
      {issue && <ErrorState message={issue} />}
      {preview && canImport && (
        <ImportPreview
          key={selection}
          preview={preview}
          onClose={() => setPreview(undefined)}
          commit={(choices, request) =>
            repository.commit(tree, preview.data, choices, request)
          }
        />
      )}
      {canExport && (
        <Card>
          <Type variant="heading" accessibilityRole="header">
            Export this tree
          </Type>
          <Choices
            label="Export privacy"
            value={exclude}
            onChange={setExclude}
            choices={[
              { value: 'exclude', label: 'Deceased people only' },
              {
                value: 'include',
                label: 'Include living and unknown-status people',
              },
            ]}
          />
          <Type tone="muted">
            {exclude === 'exclude'
              ? 'Exports deceased profiles’ names and vital dates, with connections among them. Events, sources, places and notes stay private.'
              : 'The file contains personal information and can be shared outside FamilyRoots. Get permission before sharing living relatives’ details.'}
          </Type>
          <Type tone="muted">
            Uploaded media, archived and draft profiles, disputed links, and
            historical context are excluded.
          </Type>
          <Button
            variant="secondary"
            disabled={busy}
            label="Download GEDCOM"
            onPress={() => void download()}
          />
          {exported && (
            <Type tone="success" accessibilityLiveRegion="polite">
              GEDCOM file prepared.
            </Type>
          )}
        </Card>
      )}
    </>
  );
}

function nameIndex(candidates: Candidate[]) {
  const index = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    for (const name of new Set(
      [
        candidate.display_name,
        candidate.birth_name ?? '',
        ...candidate.alternative_names,
      ].map(cleanName),
    )) {
      if (!name) continue;
      const matches = index.get(name) ?? [];
      matches.push(candidate);
      index.set(name, matches);
    }
  }
  return index;
}

function ImportPreview({
  preview,
  commit,
  onClose,
}: {
  preview: Preview;
  commit: (
    choices: Record<string, string>,
    request: string,
  ) => Promise<ImportSummary>;
  onClose: () => void;
}) {
  const { data, warnings } = preview;
  const matches = useMemo(() => {
    const lookup = nameIndex(preview.candidates);
    const earlier = new Map<string, Person[]>();
    return data.people.map((person) => {
      const tokens = new Set([person.name, ...person.aliases].map(cleanName));
      const candidates = new Map<string, Candidate>();
      const inFile = new Map<string, Person>();
      for (const token of tokens) {
        for (const item of lookup.get(token) ?? [])
          candidates.set(item.id, item);
        for (const item of earlier.get(token) ?? []) inFile.set(item.ref, item);
        earlier.set(token, [...(earlier.get(token) ?? []), person]);
      }
      return {
        existing: [...candidates.values()].sort(
          (a, b) =>
            Number(
              Boolean(person.birth.date && b.birth_date === person.birth.date),
            ) -
            Number(
              Boolean(person.birth.date && a.birth_date === person.birth.date),
            ),
        ),
        same: [...inFile.values()],
      };
    });
  }, [data, preview.candidates]);
  const names = useMemo(
    () => new Map(data.people.map((person) => [person.ref, person.name])),
    [data],
  );
  const [tab, setTab] = useState<Tab>('people');
  const [page, setPage] = useState(0);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const request = useRef<{ decisions: string; id: string } | undefined>(
    undefined,
  );
  const [issue, setIssue] = useState('');
  const [summary, setSummary] = useState<ImportSummary>();
  const pending = matches.filter(
    ({ existing, same }, index) =>
      (existing.length || same.length) && !choices[data.people[index].ref],
  ).length;
  const hasLiving = data.people.some((person) => person.status !== 'deceased');
  const pageSize = 8;
  const start = page * pageSize;
  function setDecision(person: Person, value: string) {
    setChoices((previous) => ({ ...previous, [person.ref]: value }));
  }
  async function apply() {
    setSaving(true);
    setIssue('');
    try {
      const reviewed = Object.fromEntries(
        data.people.map((person) => [
          person.ref,
          choices[person.ref] ?? 'create',
        ]),
      );
      const decisions = JSON.stringify(reviewed);
      if (request.current?.decisions !== decisions)
        request.current = { decisions, id: randomUUID() };
      setSummary(await commit(reviewed, request.current.id));
    } catch (error) {
      setIssue(transferError(error));
    } finally {
      setSaving(false);
    }
  }
  async function saveReport() {
    try {
      await saveTransferFile(
        'gedcom-field-report.txt',
        warnings
          .map(
            (entry) =>
              `Line ${entry.line}: ${entry.message}\n${entry.original}`,
          )
          .join('\n\n'),
      );
    } catch (error) {
      setIssue(transferError(error));
    }
  }
  let rows: ReactNode[];
  if (tab === 'people')
    rows = data.people.map((person, index) => (
      <PersonDecision
        key={person.ref}
        person={person}
        existing={matches[index].existing}
        same={matches[index].same.filter(
          (other) => choices[other.ref] !== 'skip',
        )}
        choice={
          choices[person.ref] ??
          (matches[index].existing.length || matches[index].same.length
            ? ''
            : 'create')
        }
        onChange={(value) => setDecision(person, value)}
      />
    ));
  else if (tab === 'relationships')
    rows = [
      ...data.parents.map((item, index) => (
        <Type key={`parent-${index}`}>
          {names.get(item.parent)} → {names.get(item.child)} · {item.kind}{' '}
          parent
        </Type>
      )),
      ...data.partners.map((item, index) => (
        <Type key={`partner-${index}`}>
          {names.get(item.a)} and {names.get(item.b)} · {item.kind} ·{' '}
          {item.status}
        </Type>
      )),
    ];
  else if (tab === 'events')
    rows = data.events.map((item, index) => (
      <Type key={index}>
        {item.title} · {item.when.date ?? 'Date unknown'} ·{' '}
        {item.people.map((id) => names.get(id)).join(', ')}
      </Type>
    ));
  else
    rows = warnings.map((entry, index) => (
      <Card key={index}>
        <Type variant="label">
          Line {entry.line} · {entry.message}
        </Type>
        <Type tone="muted">{entry.original}</Type>
      </Card>
    ));
  if (summary && !summary.failed)
    return (
      <Card>
        <Type variant="heading" accessibilityRole="header">
          Import complete
        </Type>
        <Type>
          {summary.created} people created · {summary.merged} merged ·{' '}
          {summary.relationships} connections · {summary.events} events ·{' '}
          {summary.sources} sources
        </Type>
        <Type>
          {summary.skipped} records skipped · {summary.failed} failed
        </Type>
        {summary.kept > 0 && (
          <Type>
            {summary.kept} merge decisions kept an existing value where the file
            differed.
          </Type>
        )}
        {warnings.length > 0 && (
          <Button
            label="Save field report"
            variant="secondary"
            onPress={() => void saveReport()}
          />
        )}
        {issue && <ErrorState message={issue} />}
        <Button
          label="Close import summary"
          variant="quiet"
          onPress={onClose}
        />
      </Card>
    );

  return (
    <Card>
      <Type variant="heading" accessibilityRole="header">
        Preview {preview.name}
      </Type>
      <Type>
        {data.people.length} people ·{' '}
        {data.parents.length + data.partners.length} connections ·{' '}
        {data.events.length} events · {data.sources.length} sources
      </Type>
      <Type tone="muted">
        GEDCOM {preview.version} · {warnings.length} field notices · {pending}{' '}
        duplicate decisions remaining.
      </Type>
      <Choices
        label="Preview records"
        choices={tabs}
        value={tab}
        onChange={(value) => {
          setTab(value);
          setPage(0);
        }}
      />
      {rows.length ? (
        rows.slice(start, start + pageSize)
      ) : (
        <Type tone="muted">No records in this section.</Type>
      )}
      {rows.length > pageSize && (
        <Type tone="muted">
          Page {page + 1} of {Math.ceil(rows.length / pageSize)}
        </Type>
      )}
      {page > 0 && (
        <Button
          label="Previous page"
          variant="quiet"
          onPress={() => setPage(page - 1)}
        />
      )}
      {start + pageSize < rows.length && (
        <Button
          label="Next page"
          variant="quiet"
          onPress={() => setPage(page + 1)}
        />
      )}
      {warnings.length > 0 && (
        <Button
          label="Save field report"
          variant="secondary"
          onPress={() => void saveReport()}
        />
      )}
      <Type tone="muted">
        Merges fill empty fields and keep existing values when they differ.
        Skipped people and links to them aren’t created.
      </Type>
      {hasLiving && (
        <Button
          label="I have consent to share living relatives’ information with this tree"
          variant="secondary"
          accessibilityRole="checkbox"
          selected={confirmed}
          aria-checked={confirmed}
          accessibilityState={{ checked: confirmed }}
          onPress={() => setConfirmed(!confirmed)}
        />
      )}
      {summary?.failed ? (
        <ErrorState
          message={`0 saved · ${summary.failed} failed. ${summary.error ?? 'No changes were saved.'}`}
        />
      ) : null}
      {issue && <ErrorState message={issue} />}
      <Button
        disabled={
          saving ||
          !!pending ||
          (hasLiving && !confirmed) ||
          data.people.every((person) => choices[person.ref] === 'skip')
        }
        label={saving ? 'Importing…' : 'Confirm import'}
        onPress={() => void apply()}
      />
      <Button
        label="Cancel preview"
        variant="quiet"
        disabled={saving}
        onPress={onClose}
      />
    </Card>
  );
}

function PersonDecision({
  person,
  existing,
  same,
  choice,
  onChange,
}: {
  person: Person;
  existing: Candidate[];
  same: Person[];
  choice: string;
  onChange: (value: string) => void;
}) {
  const [limit, setLimit] = useState(6);
  const all = [
    ...existing.map((item) => ({
      value: item.id,
      label: `Merge with ${item.display_name} · ${item.birth_date ?? 'birth date unknown'} · ${item.id.slice(0, 8)}`,
    })),
    ...same.map((item) => ({
      value: `same:${item.ref}`,
      label: `Merge with earlier ${item.name} ${item.ref}`,
    })),
  ];
  return (
    <Card>
      <Type variant="label">
        {person.name} {person.ref}
      </Type>
      <Type tone="muted">
        {person.birth.date ?? 'Birth date unknown'} ·{' '}
        {all.length ? `${all.length} possible matches` : 'No matches found'}
      </Type>
      <Choices
        label={`Import choice for ${person.name} ${person.ref}`}
        value={choice}
        onChange={onChange}
        choices={[
          { value: 'create', label: 'Create new person' },
          { value: 'skip', label: 'Skip person' },
          ...all.slice(0, limit),
        ]}
      />
      {all.length > limit && (
        <Button
          label="Show more matches"
          variant="quiet"
          onPress={() => setLimit(limit + 6)}
        />
      )}
    </Card>
  );
}
