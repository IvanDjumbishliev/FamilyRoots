import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { downloadArchiveFile } from '@/features/archive/archiveDownload';
import { useBooks } from '@/features/books/useBooks';
import { Choices } from '@/features/people/Choices';
import { usePeopleQuery } from '@/features/people/usePeople';
import { bookError, type BookRepository } from '@/services/bookRepository';
import { isRecordId } from '@/services/peopleRepository';

type Book = Awaited<ReturnType<BookRepository['read']>>;
type Part = Book['sections'][number];

export default function BookRoute() {
  const { bookId } = useLocalSearchParams<{ bookId?: string }>();
  const { repository } = useBooks();
  return (
    <Screen>
      <ActionLink href="/my-books" label="Back to My Books" variant="quiet" />
      {repository && isRecordId(bookId) ? (
        <BookDetail key={bookId} id={bookId} repository={repository} />
      ) : (
        <ErrorState message="This book is unavailable." />
      )}
    </Screen>
  );
}

function BookDetail({
  id,
  repository,
}: {
  id: string;
  repository: BookRepository;
}) {
  const read = useCallback(() => repository.read(id), [id, repository]);
  const query = usePeopleQuery(read);
  const book = query.data;
  const queued = book?.status === 'queued';
  const working = book?.status === 'working';
  const generation = book?.revision;
  const lastWake = useRef<number | undefined>(undefined);
  const [workerError, setWorkerError] = useState('');
  const reload = useRef(query.reload);
  reload.current = query.reload;

  const wake = useCallback(async () => {
    setWorkerError('');
    try {
      await repository.wake(id);
    } catch {
      setWorkerError(
        'The draft remains queued. Try contacting the book worker again.',
      );
    }
  }, [id, repository]);
  useEffect(() => {
    if (queued && generation !== lastWake.current) {
      lastWake.current = generation;
      void wake();
    }
  }, [generation, queued, wake]);
  useEffect(() => {
    if (!working && !queued) return;
    const interval = setInterval(() => reload.current(), 1600);
    return () => clearInterval(interval);
  }, [queued, working]);

  if (query.error)
    return <ErrorState message={query.error} onRetry={query.reload} />;
  if (!book) return <LoadingState label="Loading book…" />;
  return (
    <>
      <PageHeading
        title={book.title}
        description="Review your chapters and prepare a private PDF."
      />
      {(queued || working) && (
        <LoadingState
          label={
            book.operation === 'pdf'
              ? 'Preparing your PDF…'
              : 'Generating your draft…'
          }
        />
      )}
      {workerError && (
        <ErrorState message={workerError} onRetry={() => void wake()} />
      )}
      {book.status === 'failed' && (
        <ErrorState message={book.error ?? 'Book generation failed.'} />
      )}
      <BookEditor book={book} repository={repository} reload={query.reload} />
    </>
  );
}

function BookEditor({
  book,
  repository,
  reload,
}: {
  book: Book;
  repository: BookRepository;
  reload: () => void;
}) {
  const [key, setKey] = useState<Part['key']>('introduction');
  const [editor, setEditor] = useState<{
    id: Part['key'];
    body: string;
    revision: number;
  }>();
  const [permission, setPermission] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState('');
  const section = book.sections.find((item) => item.key === key);
  const generating = book.status === 'queued' || book.status === 'working';
  const path =
    book.status === 'ready' && book.pdf_revision === book.revision
      ? book.pdf_path
      : null;

  async function perform(fn: () => Promise<unknown>, refresh = true) {
    setIssue('');
    setBusy(true);
    try {
      await fn();
      if (refresh) reload();
    } catch (error) {
      setIssue(bookError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {book.status === 'failed' && (
        <Button
          label="Retry generation"
          disabled={busy}
          onPress={() =>
            void perform(() =>
              repository.queue(book.id, book.revision, 'retry'),
            )
          }
        />
      )}
      {!!book.sections.length && (
        <Card>
          <Choices
            label="Book sections"
            value={key}
            onChange={setKey}
            choices={book.sections.map((item) => ({
              value: item.key,
              label: item.title,
            }))}
          />
          {section && (
            <>
              <Type variant="heading" accessibilityRole="header">
                {section.title}
              </Type>
              {(section.edit !== undefined
                ? section.edit.split(/\n\n+/)
                : section.paragraphs
              ).map((block, index) => (
                <Type key={index}>{block}</Type>
              ))}
              {section.key !== 'contents' && (
                <>
                  <Button
                    label="Edit section"
                    variant="secondary"
                    disabled={busy || generating}
                    onPress={() =>
                      setEditor({
                        id: section.key,
                        body: section.edit ?? section.paragraphs.join('\n\n'),
                        revision: book.revision,
                      })
                    }
                  />
                  <Button
                    label="Regenerate section"
                    variant="quiet"
                    disabled={busy || generating}
                    onPress={() =>
                      void perform(() =>
                        repository.queue(
                          book.id,
                          book.revision,
                          'section',
                          section.key,
                        ),
                      )
                    }
                  />
                </>
              )}
            </>
          )}
          <Button
            label="I reviewed the draft for sensitive details and reproduction permissions"
            variant="secondary"
            accessibilityRole="checkbox"
            aria-checked={permission}
            selected={permission}
            accessibilityState={{ checked: permission }}
            onPress={() => setPermission(!permission)}
          />
          <Button
            label="Export PDF"
            disabled={!permission || busy || generating}
            onPress={() =>
              void perform(() =>
                repository.queue(book.id, book.revision, 'pdf'),
              )
            }
          />
          {path && (
            <Button
              label="Download PDF"
              disabled={busy}
              onPress={() =>
                void perform(async () => {
                  const url = await repository.download(path);
                  await downloadArchiveFile(
                    url,
                    'family-history.pdf',
                    'application/pdf',
                  );
                }, false)
              }
            />
          )}
        </Card>
      )}
      {!editor && issue && <ErrorState message={issue} />}
      <Dialog
        title="Edit section"
        open={!!editor}
        onClose={() => {
          setEditor(undefined);
          setIssue('');
        }}
      >
        {editor && (
          <>
            <Type tone="muted">
              Keep reference labels such as [R1] if the text relies on those
              sources. Review personal details you add before export.
            </Type>
            <TextField
              label="Section text"
              multiline
              maxLength={20000}
              value={editor.body}
              onChangeText={(body) => setEditor({ ...editor, body })}
            />
            {issue && <ErrorState message={issue} />}
            <Button
              label="Save section"
              disabled={busy || editor.body.length > 20000}
              onPress={() =>
                void perform(async () => {
                  await repository.edit(
                    book.id,
                    editor.revision,
                    editor.id,
                    editor.body,
                  );
                  setEditor(undefined);
                  setPermission(false);
                })
              }
            />
          </>
        )}
      </Dialog>
    </>
  );
}
