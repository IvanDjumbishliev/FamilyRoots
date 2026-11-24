import { useRouter } from 'expo-router';
import { useState } from 'react';

import { BookWizard } from '@/features/books/BookWizard';
import { useBooks } from '@/features/books/useBooks';
import { Card } from '@/components/Card';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { FormActions } from '@/features/family/FormActions';
import { useFamily } from '@/features/family/useFamily';
import { useSave } from '@/features/family/useSave';

export default function CreateBookScreen() {
  const { repository, people, archive, firstTree } = useBooks();
  if (!repository || !people || !archive || !firstTree)
    return <DemoCreateBook />;
  return (
    <Screen>
      <PageHeading
        title="Create Book"
        description="Choose the family story, material, and privacy settings."
      />
      <BookWizard
        repository={repository}
        people={people}
        archive={archive}
        firstTree={firstTree}
      />
    </Screen>
  );
}
function DemoCreateBook() {
  const router = useRouter();
  const { repository, workspace } = useFamily();
  const { save, saving, error } = useSave();
  const [title, setTitle] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    setSubmitted(true);
    if (title.trim())
      void save(
        () => repository.createBook(workspace, title.trim()),
        () => router.dismissTo('/my-books'),
      );
  }

  return (
    <Screen>
      <PageHeading
        title="Create Book"
        description="Start a draft with a simple outline for your family’s story."
      />
      <Card>
        <TextField
          label="Book title"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          error={submitted && !title.trim() ? 'Enter a book title.' : undefined}
        />
        <FormActions
          cancelTo="/my-books"
          label="Create draft"
          onSubmit={submit}
          saving={saving}
          error={error}
        />
      </Card>
    </Screen>
  );
}
