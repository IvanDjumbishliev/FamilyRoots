import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { z } from 'zod';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { Type } from '@/components/Type';
import { MemoryFileField } from '@/features/family/MemoryFileField';
import type { MemoryFile } from '@/features/family/memoryFile';
import { useSave } from '@/features/family/useSave';
import { usePeopleQuery } from '@/features/people/usePeople';
import {
  archiveError,
  type ArchiveRepository,
} from '@/services/archiveRepository';

import { ArchiveForm } from './ArchiveForm';
import {
  archiveDefaults,
  archiveMimeTypes,
  archiveSchema,
} from './archiveMetadata';
import { prepareArchiveUpload } from './prepareUpload';

export function ArchiveUpload({
  repository,
  treeId,
}: {
  repository: ArchiveRepository;
  treeId: string;
}) {
  const router = useRouter();
  const read = useCallback(
    () => repository.context(treeId),
    [repository, treeId],
  );
  const context = usePeopleQuery(read);
  const [file, setFile] = useState<MemoryFile>();
  const [values, setValues] = useState(archiveDefaults);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [duplicate, setDuplicate] = useState<string>();
  const request = useSave();
  const parsed = archiveSchema.safeParse(values);
  const errors =
    submitted && !parsed.success
      ? z.flattenError(parsed.error).fieldErrors
      : {};

  function submit() {
    setSubmitted(true);
    setDuplicate(undefined);
    setMessage('');
    if (!file) return setMessage('Choose a file to upload.');
    if (!parsed.success) return;
    const selected = file;
    const meta = parsed.data;
    void request.save(
      async () => {
        try {
          const body = await prepareArchiveUpload(selected, treeId, meta);
          const result = await repository.upload(treeId, body);
          if (result.duplicate) setDuplicate(result.id);
          else
            router.replace({
              pathname: '/family-archive/[itemId]',
              params: { itemId: result.id },
            });
        } catch (error) {
          setMessage(await archiveError(error));
          throw error;
        }
      },
      () => undefined,
    );
  }

  return (
    <Screen>
      <PageHeading
        title="Upload Memory"
        description="Preserve an original file and record who or what it describes."
      />
      <ActionLink
        href={{ pathname: '/family-archive', params: { treeId } }}
        label="Back to Family Archive"
        variant="quiet"
        dismissTo
      />
      {context.error ? (
        <ErrorState message={context.error} onRetry={context.reload} />
      ) : !context.data ? (
        <LoadingState label="Checking archive access…" />
      ) : !context.data.canEdit ? (
        <Card>
          <Type tone="muted">
            Only owners and editors can upload to this archive.
          </Type>
        </Card>
      ) : (
        <Card>
          <Type tone="muted">
            JPEG, PNG, PDF, and UTF-8 text up to 10 MB. Images get a compressed
            preview and thumbnail.
          </Type>
          <MemoryFileField
            allowedMimeTypes={archiveMimeTypes}
            file={file}
            onError={(error) => {
              setFile(undefined);
              setMessage(error);
            }}
            onFile={(next) => {
              setFile(next);
              setMessage('');
              setDuplicate(undefined);
              setValues((previous) =>
                previous.title
                  ? previous
                  : {
                      ...previous,
                      title: next.name.replace(/\.[^.]+$/, '').slice(0, 200),
                    },
              );
            }}
          />
          <ArchiveForm
            value={values}
            onChange={setValues}
            context={context.data}
            errors={errors}
            createEvent={(title) => repository.createEvent(treeId, title)}
          />
          {message && (
            <Type tone="danger" accessibilityRole="alert">
              {message}
            </Type>
          )}
          {duplicate && (
            <>
              <Type accessibilityLiveRegion="polite">
                This file is already in this archive. The existing item is
                unchanged.
              </Type>
              <ActionLink
                href={{
                  pathname: '/family-archive/[itemId]',
                  params: { itemId: duplicate },
                }}
                label="Open existing item"
                variant="secondary"
              />
            </>
          )}
          <Button
            label={
              request.saving
                ? 'Uploading…'
                : request.error
                  ? 'Retry upload'
                  : 'Save to archive'
            }
            disabled={request.saving}
            onPress={submit}
          />
        </Card>
      )}
    </Screen>
  );
}
