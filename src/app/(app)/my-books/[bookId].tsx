import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ActionLink } from '@/components/ActionLink';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { BookEditor } from '@/features/books/BookEditor';
import { useBooks } from '@/features/books/useBooks';
import { usePeopleQuery } from '@/features/people/usePeople';
import type { BookRepository } from '@/services/bookRepository';
import { isRecordId } from '@/services/peopleRepository';
import type { BookMedia } from '../../../../supabase/functions/family-book-worker/book';

export default function BookRoute() {
  const { bookId } = useLocalSearchParams<{ bookId?: string }>();
  const { repository, archive } = useBooks();

  return (
    <Screen>
      <ActionLink href="/my-books" label="Back to My Books" variant="quiet" />
      {repository && isRecordId(bookId) ? (
        <BookDetail
          key={bookId}
          id={bookId}
          repository={repository}
          archive={archive}
        />
      ) : (
        <ErrorState message="This book is unavailable." />
      )}
    </Screen>
  );
}

function BookDetail({
  id,
  repository,
  archive,
}: {
  id: string;
  repository: BookRepository;
  archive?: any;
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

  // Fetch available archive items for photograph selection
  const [mediaItems, setMediaItems] = useState<BookMedia[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadMedia() {
      if (!archive || !book) return;
      try {
        const items = await archive.items(book.tree_id);
        if (mounted && Array.isArray(items)) {
          setMediaItems(
            items.map((i: any) => ({
              id: i.id,
              title: i.title,
              credit: i.source_note,
              mime: i.mime_type,
              path: i.thumbnail_path,
              description: i.description,
            })),
          );
        }
      } catch {
        // archive items optional
      }
    }
    void loadMedia();
    return () => {
      mounted = false;
    };
  }, [archive, book]);

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
        description="Customize your family history book: edit text, reorder chapters, choose templates, and export PDF."
      />
      {(queued || working) && (
        <LoadingState
          label={
            book.operation === 'pdf'
              ? 'Preparing your updated PDF…'
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
      <BookEditor
        book={book}
        repository={repository}
        reload={query.reload}
        availableMedia={mediaItems}
      />
    </>
  );
}
