import { ActionLink } from '@/components/ActionLink';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { State } from '@/components/State';
import { Type } from '@/components/Type';
import { usePeopleQuery } from '@/features/people/usePeople';
import type { BookRepository } from '@/services/bookRepository';

export function ConnectedBooks({ repository }: { repository: BookRepository }) {
  const query = usePeopleQuery(repository.list);
  if (query.error)
    return <ErrorState message={query.error} onRetry={query.reload} />;
  if (!query.data) return <LoadingState label="Loading books…" />;
  if (!query.data.length)
    return (
      <State
        kind="empty"
        title="No book drafts yet"
        message="Create a draft from your family tree or the fictional sample."
      />
    );
  return query.data.map((book) => (
    <Card key={book.id}>
      <Type variant="heading" accessibilityRole="header">
        {book.title}
      </Type>
      <Type tone="muted">
        {
          (
            {
              queued: 'Queued',
              working: 'Generating',
              ready: 'Ready to review',
              failed: 'Generation failed',
            } as Record<string, string>
          )[book.status]
        }
      </Type>
      <ActionLink
        href={{ pathname: '/my-books/[bookId]', params: { bookId: book.id } }}
        label={`Open ${book.title}`}
        variant="secondary"
      />
    </Card>
  ));
}
