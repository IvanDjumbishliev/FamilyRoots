import { ConnectedBooks } from '@/features/books/ConnectedBooks';
import { useBooks } from '@/features/books/useBooks';
import { useState } from 'react';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { State } from '@/components/State';
import { Type } from '@/components/Type';
import { useFamily } from '@/features/family/useFamily';
import type { Book } from '@/types/family';

export default function BooksScreen() {
  const { repository } = useBooks();
  if (!repository) return <DemoBooks />;
  return (
    <Screen>
      <PageHeading
        title="My Books"
        description="Create, edit, and export a family history book."
      />
      <ActionLink href="/my-books/create" icon="book" label="Create Book" />
      <ConnectedBooks repository={repository} />
    </Screen>
  );
}

function DemoBooks() {
  const { snapshot } = useFamily();
  const [preview, setPreview] = useState<Book>();

  return (
    <Screen>
      <PageHeading
        title="My Books"
        description="Family history book drafts and their outlines."
      />
      <ActionLink href="/my-books/create" icon="book" label="Create Book" />
      {snapshot.books.length ? (
        snapshot.books.map((book) => (
          <Card key={book.id}>
            <Type variant="heading" accessibilityRole="header">
              {book.title}
            </Type>
            <Type tone="muted">Draft · {book.chapters.length} chapters</Type>
            <Button
              label="View outline"
              accessibilityLabel={`View outline for ${book.title}`}
              variant="secondary"
              onPress={() => setPreview(book)}
            />
          </Card>
        ))
      ) : (
        <Card>
          <State
            kind="empty"
            title="No book drafts yet"
            message="Create a draft to plan a book around your family tree, milestones, and memories."
          />
        </Card>
      )}
      <Dialog
        open={Boolean(preview)}
        title={preview?.title ?? 'Book outline'}
        onClose={() => setPreview(undefined)}
      >
        {preview?.chapters.map((chapter, index) => (
          <Type key={chapter}>
            {index + 1}. {chapter}
          </Type>
        ))}
      </Dialog>
    </Screen>
  );
}
