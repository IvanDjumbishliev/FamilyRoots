import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { Choices } from '@/features/people/Choices';
import { usePeopleQuery } from '@/features/people/usePeople';
import { RelativePicker } from '@/features/relationships/RelativePicker';
import type { createArchiveRepository } from '@/services/archiveRepository';
import { bookError, type BookRepository } from '@/services/bookRepository';
import type { PeopleRepository } from '@/services/peopleRepository';

import {
  outline,
  type BookSettings,
} from '../../../supabase/functions/family-book-worker/book';

const defaults: BookSettings = {
  title: '',
  subtitle: '',
  author: '',
  copyright: '',
  dedication: '',
  language: 'en',
  theme: 'forest',
  branch: null,
  sample: false,
  privacy: 'private',
  consent: false,
  biographies: [],
  events: [],
  media: [],
};
const steps = [
  'Family tree and scope',
  'Title and attribution',
  'Language, theme and privacy',
  'Included material',
  'Preview outline',
];
export function BookWizard({
  firstTree,
  people,
  archive,
  repository,
}: {
  firstTree: string;
  people: PeopleRepository;
  archive: ReturnType<typeof createArchiveRepository>;
  repository: BookRepository;
}) {
  const trees = usePeopleQuery(people.trees);
  const [tree, setTree] = useState(firstTree);
  return (
    <>
      {trees.error && (
        <ErrorState message={trees.error} onRetry={trees.reload} />
      )}
      {!trees.data ? (
        <LoadingState label="Loading family trees…" />
      ) : (
        <>
          <Choices
            label="Family tree"
            choices={trees.data.map(({ id, name }) => ({
              value: id,
              label: name,
            }))}
            value={tree}
            onChange={setTree}
          />
          <WizardForm
            key={tree}
            repository={repository}
            tree={tree}
            people={people}
            archive={archive}
          />
        </>
      )}
    </>
  );
}

function WizardForm({
  tree,
  people,
  archive,
  repository,
}: {
  tree: string;
  people: PeopleRepository;
  archive: ReturnType<typeof createArchiveRepository>;
  repository: BookRepository;
}) {
  const router = useRouter();
  const read = useCallback(async () => {
    const [directory, assets, files] = await Promise.all([
      people.directory(tree),
      archive.context(tree),
      archive.items(tree),
    ]);
    return { directory, assets, files };
  }, [archive, people, tree]);
  const data = usePeopleQuery(read);
  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState(defaults);
  const [scope, setScope] = useState<'all' | 'branch' | 'sample'>('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'bios' | 'events' | 'media'>('bios');
  const set = <K extends keyof BookSettings>(key: K, value: BookSettings[K]) =>
    setSettings((previous) => ({ ...previous, [key]: value }));
  if (data.error)
    return <ErrorState message={data.error} onRetry={data.reload} />;
  if (!data.data) return <LoadingState label="Loading book material…" />;
  const { directory, assets, files } = data.data;
  const active = directory.people.filter((p) => !p.archived_at && !p.is_draft);
  const eligible = active.filter(
    (p) => settings.privacy !== 'private' || p.living_status === 'deceased',
  );
  if (!directory.canEdit)
    return <Type>Only tree owners and editors can generate books.</Type>;

  function continueWizard() {
    setMessage('');
    if (step === 0 && scope === 'branch' && !settings.branch) {
      setMessage('Choose the first person in the branch.');
      return;
    }
    if (step === 1 && (!settings.title.trim() || !settings.author.trim())) {
      setMessage('Enter a title and author or family attribution.');
      return;
    }
    if (step === 2 && settings.privacy === 'full' && !settings.consent) {
      setMessage('Confirm you have permission to include private information.');
      return;
    }
    setStep(step + 1);
  }
  async function create() {
    setBusy(true);
    setMessage('');
    try {
      const id = await repository.create(tree, {
        ...settings,
        title: settings.title.trim(),
        author: settings.author.trim(),
        biographies: settings.biographies.filter((id) =>
          eligible.some((p) => p.id === id),
        ),
        media: settings.privacy === 'private' ? [] : settings.media,
        sample: scope === 'sample',
      });
      router.replace({
        pathname: '/my-books/[bookId]',
        params: { bookId: id },
      });
    } catch (error) {
      setMessage(bookError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <Type variant="heading" accessibilityRole="header">
        {steps[step]}
      </Type>
      <Type tone="muted">
        Step {step + 1} of {steps.length}
      </Type>
      {step === 0 && (
        <>
          <Choices
            label="Book scope"
            value={scope}
            onChange={(value) => {
              setScope(value);
              setSettings((previous) => ({
                ...previous,
                branch: null,
                biographies: [],
                events: [],
                media: [],
                sample: value === 'sample',
              }));
            }}
            choices={[
              { value: 'all', label: 'Entire family' },
              { value: 'branch', label: 'Verified descendant branch' },
              { value: 'sample', label: 'Fictional sample family' },
            ]}
          />
          {scope === 'branch' && (
            <RelativePicker
              people={active}
              selected={settings.branch ?? undefined}
              onSelect={(id) => set('branch', id)}
              label="Find the branch’s first person"
            />
          )}
          {scope === 'sample' && (
            <Type tone="muted">
              Build a practice book with fictional profiles, a family event, and
              a sample source.
            </Type>
          )}
        </>
      )}
      {step === 1 && (
        <>
          <TextField
            label="Book title"
            value={settings.title}
            onChangeText={(value) => set('title', value)}
            maxLength={120}
          />
          <TextField
            label="Subtitle"
            value={settings.subtitle}
            onChangeText={(value) => set('subtitle', value)}
            maxLength={220}
          />
          <TextField
            label="Author or family attribution"
            value={settings.author}
            onChangeText={(value) => set('author', value)}
            maxLength={120}
          />
          <TextField
            label="Copyright notice"
            value={settings.copyright}
            onChangeText={(value) => set('copyright', value)}
            maxLength={800}
            multiline
            hint="Enter a notice and any credits you have permission to use."
          />
          <TextField
            label="Dedication"
            value={settings.dedication}
            onChangeText={(value) => set('dedication', value)}
            maxLength={1200}
            multiline
          />
        </>
      )}
      {step === 2 && (
        <>
          <Choices
            label="Book language"
            value={settings.language}
            onChange={(value) => set('language', value)}
            choices={[
              { value: 'en', label: 'English' },
              { value: 'es', label: 'Español' },
              { value: 'bg', label: 'Български' },
            ]}
          />
          <Choices
            label="Visual theme"
            value={settings.theme}
            onChange={(value) => set('theme', value)}
            choices={[
              { value: 'forest', label: 'Forest' },
              { value: 'ink', label: 'Ink' },
              { value: 'sepia', label: 'Sepia' },
            ]}
          />
          <Choices
            label="Privacy"
            value={settings.privacy}
            onChange={(value) =>
              setSettings((previous) => ({
                ...previous,
                privacy: value,
                consent: false,
                media: [],
                biographies: [],
              }))
            }
            choices={[
              { value: 'private', label: 'Deceased people only' },
              { value: 'full', label: 'Include selected private details' },
            ]}
          />
          <Type tone="muted">
            {settings.privacy === 'private'
              ? 'Omits living and unknown-status profiles, places, notes, archive files, and source titles.'
              : 'May include living people’s information and archive images. Only select files you have permission to reproduce.'}
          </Type>
          {settings.privacy === 'full' && (
            <Button
              label="I have permission to include this material"
              variant="secondary"
              accessibilityRole="checkbox"
              selected={settings.consent}
              aria-checked={settings.consent}
              accessibilityState={{ checked: settings.consent }}
              onPress={() => set('consent', !settings.consent)}
            />
          )}
        </>
      )}
      {step === 3 &&
        (scope === 'sample' ? (
          <Type>
            The fictional biographies, event, and citation are included
            automatically.
          </Type>
        ) : (
          <>
            <Choices
              label="Material to include"
              value={mode}
              onChange={setMode}
              choices={[
                { value: 'bios', label: 'Biographies' },
                { value: 'events', label: 'Events' },
                { value: 'media', label: 'Photographs and documents' },
              ]}
            />
            {mode === 'bios' && (
              <PickList
                key="biographies"
                items={eligible.map(({ id, display_name }) => ({
                  id,
                  title: display_name,
                }))}
                name="biographies"
                chosen={settings.biographies}
                limit={100}
                onChange={(value) => set('biographies', value)}
              />
            )}
            {mode === 'events' && (
              <PickList
                key="events"
                items={assets.events}
                name="events"
                chosen={settings.events}
                limit={100}
                onChange={(value) => set('events', value)}
              />
            )}
            {mode === 'media' &&
              (settings.privacy === 'private' ? (
                <Type tone="muted">
                  This privacy setting omits archive media.
                </Type>
              ) : (
                <PickList
                  key="media"
                  items={files}
                  name="archive files"
                  limit={10}
                  chosen={settings.media}
                  onChange={(value) => set('media', value)}
                />
              ))}
            <Type tone="muted">
              The worker includes verified events and applies the chosen branch
              and privacy settings. Documents appear as references. Supported
              photo thumbnails appear in the PDF.
            </Type>
          </>
        ))}
      {step === 4 && (
        <>
          <Type variant="label">
            {settings.title} · {settings.author}
          </Type>
          {outline(settings.language).map((section) => (
            <Type key={section.key}>{section.title}</Type>
          ))}
          {scope !== 'sample' && (
            <Type tone="muted">
              {settings.biographies.length} biographies selected ·{' '}
              {settings.events.length} events selected · {settings.media.length}{' '}
              archive files selected
            </Type>
          )}
          <Type tone="muted">
            Draft and PDF generation run in the background. Review the draft
            before exporting.
          </Type>
        </>
      )}
      {message && <ErrorState message={message} />}
      {step < 4 ? (
        <Button label="Continue" onPress={continueWizard} />
      ) : (
        <Button
          label={busy ? 'Creating…' : 'Generate draft'}
          disabled={busy}
          onPress={() => void create()}
        />
      )}
      {step > 0 && (
        <Button
          label="Back"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setMessage('');
            setStep(step - 1);
          }}
        />
      )}
      <ActionLink href="/my-books" label="Cancel" variant="quiet" />
    </Card>
  );
}

function PickList({
  items,
  name,
  chosen,
  limit,
  onChange,
}: {
  items: readonly { id: string; title: string }[];
  name: string;
  chosen: string[];
  limit: number;
  onChange: (value: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const matching = items.filter(({ title }) =>
    title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <>
      <TextField
        label={`Find ${name}`}
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setPage(0);
        }}
      />
      <Type tone="muted">
        {chosen.length} selected · limit {limit}
      </Type>
      {items.length > 0 && items.length <= limit && (
        <Button
          label={`Select all ${name}`}
          variant="quiet"
          onPress={() => onChange(items.map(({ id }) => id))}
        />
      )}
      {matching.slice(page * 8, (page + 1) * 8).map(({ id, title }) => {
        const checked = chosen.includes(id);
        return (
          <Button
            key={id}
            label={title}
            variant="secondary"
            selected={checked}
            accessibilityRole="checkbox"
            aria-checked={checked}
            accessibilityState={{ checked }}
            disabled={!checked && chosen.length >= limit}
            onPress={() =>
              onChange(
                checked
                  ? chosen.filter((item) => item !== id)
                  : [...chosen, id],
              )
            }
          />
        );
      })}
      {!matching.length && <Type tone="muted">No matching material.</Type>}
      {page > 0 && (
        <Button
          label="Previous results"
          variant="quiet"
          onPress={() => setPage(page - 1)}
        />
      )}
      {(page + 1) * 8 < matching.length && (
        <Button
          label="More results"
          variant="quiet"
          onPress={() => setPage(page + 1)}
        />
      )}
    </>
  );
}
