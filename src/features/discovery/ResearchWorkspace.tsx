import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { State } from '@/components/State';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { Choices } from '@/features/people/Choices';
import { usePeopleQuery } from '@/features/people/usePeople';
import { RelativePicker } from '@/features/relationships/RelativePicker';
import type { PeopleRepository } from '@/services/peopleRepository';
import type {
  Hypothesis,
  ResearchAction,
  ResearchRepository,
} from '@/services/researchRepository';

import {
  recordTypes,
  searchForm,
  typeLabels,
  type HistoricalQuery,
  type HistoricalRecord,
  type SearchHit,
} from './historicalSearch';

type Saved = Awaited<ReturnType<ResearchRepository['saved']>>[number];
type Form = z.input<typeof searchForm>;
const formDefaults: Form = {
  name: '',
  place: '',
  from: '',
  to: '',
  type: 'all',
};
const tabs = [
  { value: 'search', label: 'Search records' },
  { value: 'saved', label: 'Saved research' },
] as const;
const hypotheses = [
  { value: 'parent', label: 'Possible parent of the compared person' },
  { value: 'child', label: 'Possible child of the compared person' },
  { value: 'partner', label: 'Possible partner of the compared person' },
] as const;

export function ResearchWorkspace({
  repository,
  people,
  tree,
}: {
  repository: ResearchRepository;
  people: PeopleRepository;
  tree: string;
}) {
  const fetchSaved = useCallback(
    () => repository.saved(tree),
    [repository, tree],
  );
  const fetchDirectory = useCallback(
    () => people.directory(tree),
    [people, tree],
  );
  const saved = usePeopleQuery(fetchSaved);
  const directory = usePeopleQuery(fetchDirectory);
  const [form, setForm] = useState<Form>(formDefaults);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string[]>>>(
    {},
  );
  const [searching, setSearching] = useState(false);
  const [result, setResult] =
    useState<Awaited<ReturnType<ResearchRepository['search']>>>();
  const [last, setLast] = useState<HistoricalQuery>();
  const [tab, setTab] = useState<'search' | 'saved'>('search');
  const [open, setOpen] = useState<SearchHit>();
  const lookup = new Map(
    saved.data?.map((item) => [
      item.record.provider + ':' + item.record.id,
      item,
    ]),
  );

  async function run(query: HistoricalQuery) {
    setSearching(true);
    setLast(query);
    try {
      setResult(await repository.search(query));
    } finally {
      setSearching(false);
    }
  }
  function edit<K extends keyof Form>(field: K, value: Form[K]) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  return (
    <>
      <Type tone="muted">
        Live historical data is unavailable. Use the Fictional Archive to
        practice searching and comparing records.
      </Type>
      <Choices
        label="Historical research workspace"
        choices={tabs}
        value={tab}
        onChange={setTab}
      />
      {tab === 'search' ? (
        <>
          <Card>
            <Type variant="heading" accessibilityRole="header">
              Search historical records
            </Type>
            <TextField
              label="Name"
              hint="Try Ada Valette."
              value={form.name}
              autoCorrect={false}
              onChangeText={(v) => edit('name', v)}
              error={errors.name?.[0]}
              maxLength={120}
            />
            <TextField
              label="Town, region, or country"
              value={form.place}
              onChangeText={(v) => edit('place', v)}
              error={errors.place?.[0]}
              maxLength={120}
            />
            <TextField
              label="From year"
              value={form.from}
              onChangeText={(v) => edit('from', v)}
              error={errors.from?.[0]}
              maxLength={4}
              keyboardType="number-pad"
            />
            <TextField
              label="To year"
              value={form.to}
              onChangeText={(v) => edit('to', v)}
              error={errors.to?.[0]}
              maxLength={4}
              keyboardType="number-pad"
            />
            <Choices
              label="Record type"
              choices={(['all', ...recordTypes] as const).map((value) => ({
                value,
                label: typeLabels[value],
              }))}
              value={form.type}
              onChange={(v) => edit('type', v)}
            />
            <Button
              label="Search"
              disabled={searching}
              onPress={() => {
                const parsed = searchForm.safeParse(form);
                if (!parsed.success) {
                  setErrors(z.flattenError(parsed.error).fieldErrors);
                  return;
                }
                void run(parsed.data);
              }}
            />
          </Card>
          {searching ? (
            <LoadingState label="Searching historical records…" />
          ) : (
            result && (
              <>
                {result.errors.map((error) => (
                  <ErrorState
                    key={error.provider}
                    message={`${error.provider} · ${error.message}`}
                    onRetry={last ? () => void run(last) : undefined}
                  />
                ))}
                {result.hits.length
                  ? result.hits.map((hit) => (
                      <ResultCard
                        key={hit.record.provider + ':' + hit.record.id}
                        hit={hit}
                        saved={lookup.get(
                          hit.record.provider + ':' + hit.record.id,
                        )}
                        onOpen={() => setOpen(hit)}
                      />
                    ))
                  : !result.errors.length && (
                      <State
                        kind="empty"
                        title="No matching records"
                        message="Try a shorter name, a broader year range, or another place."
                      />
                    )}
              </>
            )
          )}
        </>
      ) : saved.error ? (
        <ErrorState message={saved.error} onRetry={saved.reload} />
      ) : !saved.data ? (
        <LoadingState label="Loading saved research…" />
      ) : saved.data.length ? (
        saved.data.map((item) => {
          const hit = {
            record: item.record,
            attributions: [item.record],
            allowSaving: true,
          };
          return (
            <ResultCard
              key={item.id}
              hit={hit}
              saved={item}
              onOpen={() => setOpen(hit)}
            />
          );
        })
      ) : (
        <State
          kind="empty"
          title="No saved findings"
          message="Open a search result to save it or record a comparison."
        />
      )}
      <Dialog
        open={!!open}
        title="Research finding"
        onClose={() => setOpen(undefined)}
      >
        {open && (
          <FindingDetail
            key={open.record.provider + ':' + open.record.id}
            hit={open}
            repository={repository}
            people={people}
            tree={tree}
            saved={lookup.get(open.record.provider + ':' + open.record.id)}
            directory={directory.data}
            directoryError={directory.error}
            retryDirectory={directory.reload}
            onSaved={saved.reload}
          />
        )}
      </Dialog>
    </>
  );
}

function Attribution({ record }: { record: HistoricalRecord }) {
  return (
    <>
      <Type variant="detail" tone="muted">
        {record.collection} · {record.locator} · {record.license}
      </Type>
      <Type variant="detail" tone="muted">
        Retrieved {new Date(record.retrievedAt).toLocaleDateString()}
      </Type>
      {record.fictional ? (
        <Type variant="detail" tone="muted">
          Fictional source URL · {record.url}
        </Type>
      ) : (
        <Button
          label="Open record at source"
          variant="quiet"
          onPress={() => void Linking.openURL(record.url)}
        />
      )}
    </>
  );
}

function ResultCard({
  hit,
  saved,
  onOpen,
}: {
  hit: SearchHit;
  saved?: Saved;
  onOpen: () => void;
}) {
  const { record } = hit;
  return (
    <Card>
      <Type variant="heading" accessibilityRole="header">
        {record.title}
      </Type>
      <Type>
        {typeLabels[record.type]} · {record.year} · {record.place}
      </Type>
      <Attribution record={record} />
      {!!saved?.matches.length && (
        <Type tone="muted">
          {saved.matches.filter((match) => match.status === 'attached').length}{' '}
          attached ·{' '}
          {saved.matches.filter((match) => match.status === 'rejected').length}{' '}
          rejected · {saved.matches.filter((match) => match.hypothesis).length}{' '}
          unverified hypotheses
        </Type>
      )}
      <Button
        label={`Review ${record.title}`}
        variant="secondary"
        onPress={onOpen}
      />
    </Card>
  );
}

type Directory = Awaited<ReturnType<PeopleRepository['directory']>>;
function FindingDetail({
  hit,
  repository,
  people,
  tree,
  saved,
  directory,
  directoryError,
  retryDirectory,
  onSaved,
}: {
  hit: SearchHit;
  repository: ResearchRepository;
  people: PeopleRepository;
  tree: string;
  saved?: Saved;
  directory?: Directory;
  directoryError?: string;
  retryDirectory: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string>();
  const [related, setRelated] = useState<string>();
  const [hypothesis, setHypothesis] = useState<Hypothesis>('parent');
  const [showHypothesis, setShowHypothesis] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState('');
  const [success, setSuccess] = useState('');
  const active =
    directory?.people.filter(
      (person) => !person.archived_at && !person.is_draft,
    ) ?? [];
  const read = useCallback(
    () => (selected ? people.person(selected) : Promise.resolve(undefined)),
    [people, selected],
  );
  const comparison = usePeopleQuery(read);
  const match = saved?.matches.find((item) => item.person_id === selected);
  const canEdit = !!directory?.canEdit && hit.allowSaving;
  const { record } = hit;
  const profile = comparison.data?.person;
  async function update(action: ResearchAction) {
    setIssue('');
    setSuccess('');
    setBusy(true);
    try {
      await repository.update(
        tree,
        record.provider,
        record.id,
        action,
        selected,
        related,
        hypothesis,
      );
      setSuccess(
        {
          save: 'Finding saved.',
          attach: 'Fictional citation attached.',
          reject: 'Match rejected for this person.',
          hypothesis: 'Unverified relationship hypothesis saved.',
        }[action],
      );
      onSaved();
    } catch {
      setIssue(
        'Couldn’t save this decision. Check your permissions or refresh the finding.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Type variant="heading">{record.title}</Type>
      <Type>
        {record.name} · {record.year} · {record.place}
      </Type>
      {hit.attributions.map((source) => (
        <Attribution key={source.provider + ':' + source.id} record={source} />
      ))}
      {record.fictional && (
        <Type tone="muted">
          This is a fictional practice record. It cannot substantiate a family
          relationship.
        </Type>
      )}
      {canEdit && (
        <Button
          label={saved ? 'Finding saved' : 'Save finding'}
          disabled={busy || !!saved}
          variant="secondary"
          onPress={() => void update('save')}
        />
      )}
      {directoryError ? (
        <ErrorState message={directoryError} onRetry={retryDirectory} />
      ) : !directory ? (
        <LoadingState label="Loading people…" />
      ) : active.length ? (
        <RelativePicker
          people={active}
          selected={selected}
          onSelect={(id) => {
            setSelected(id);
            setRelated(undefined);
            setShowHypothesis(false);
            setSuccess('');
            setIssue('');
          }}
          label="Compare with a person"
        />
      ) : (
        <Type tone="muted">
          Add a person to this tree to compare and attach findings.
        </Type>
      )}
      {selected &&
        (comparison.error ? (
          <ErrorState message={comparison.error} onRetry={comparison.reload} />
        ) : !profile ? (
          <LoadingState label="Loading comparison…" />
        ) : (
          <Card>
            <Type variant="label">Tree profile · {profile.display_name}</Type>
            <Type>
              Birth ·{' '}
              {profile.birth_date
                ? profile.birth_date.slice(0, 4)
                : 'Year unknown'}{' '}
              {profile.birth_place ?? ''}
            </Type>
            <Type>
              Death ·{' '}
              {profile.death_date
                ? profile.death_date.slice(0, 4)
                : 'Year unknown'}{' '}
              {profile.death_place ?? ''}
            </Type>
            <Type variant="label">Historical record · {record.name}</Type>
            <Type>
              {typeLabels[record.type]} · {record.year} · {record.place}
            </Type>
            {match && (
              <Type tone="muted">
                Match status · {match.status}
                {match.hypothesis
                  ? ` · Unverified ${match.hypothesis} hypothesis · ${active.find((person) => person.id === match.related_person_id)?.display_name ?? 'Related profile unavailable'}`
                  : ''}
              </Type>
            )}
            {canEdit && match?.status !== 'attached' && (
              <>
                <Button
                  label="Attach fictional citation"
                  disabled={busy}
                  onPress={() => void update('attach')}
                />
                <Button
                  label="Reject this match"
                  disabled={busy || match?.status === 'rejected'}
                  variant="secondary"
                  onPress={() => void update('reject')}
                />
                {active.length > 1 && (
                  <Button
                    label="Record an unverified relationship"
                    disabled={busy}
                    variant="quiet"
                    onPress={() => setShowHypothesis(!showHypothesis)}
                  />
                )}
                {showHypothesis && (
                  <>
                    <Choices
                      label="Relationship hypothesis"
                      choices={hypotheses}
                      value={hypothesis}
                      onChange={setHypothesis}
                    />
                    <RelativePicker
                      people={active.filter((person) => person.id !== selected)}
                      selected={related}
                      onSelect={setRelated}
                      label="Find the other person"
                      optionLabel={(person) =>
                        `Choose ${person.display_name} as other person`
                      }
                    />
                    <Button
                      label="Save unverified hypothesis"
                      disabled={busy || !related}
                      onPress={() => void update('hypothesis')}
                    />
                  </>
                )}
              </>
            )}
          </Card>
        ))}
      {issue && <ErrorState message={issue} />}
      {success && (
        <Type tone="success" accessibilityLiveRegion="polite">
          {success}
        </Type>
      )}
    </>
  );
}
