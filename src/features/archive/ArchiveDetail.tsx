import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, View } from 'react-native';
import { z } from 'zod';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { Type } from '@/components/Type';
import { useSave } from '@/features/family/useSave';
import { formatHistoricalDate } from '@/features/people/personForm';
import { usePeopleQuery } from '@/features/people/usePeople';
import {
  archiveError,
  type ArchiveContextData,
  type ArchiveItem,
  type ArchiveRepository,
} from '@/services/archiveRepository';

import { downloadArchiveFile, openPdfPreview } from './archiveDownload';
import { ArchiveForm } from './ArchiveForm';
import { archiveDefaults, archiveSchema } from './archiveMetadata';

export function ArchiveDetail({
  repository,
  userId,
  itemId,
}: {
  repository: ArchiveRepository;
  userId: string;
  itemId: string;
}) {
  const read = useCallback(async () => {
    const item = await repository.item(itemId);
    return { item, context: await repository.context(item.tree_id) };
  }, [repository, itemId]);
  const result = usePeopleQuery(read);
  const item = result.data?.item;

  return (
    <Screen>
      <ActionLink
        label="Back to Family Archive"
        variant="quiet"
        dismissTo
        href={
          item
            ? { pathname: '/family-archive', params: { treeId: item.tree_id } }
            : '/family-archive'
        }
      />
      {result.error ? (
        <ErrorState message={result.error} onRetry={result.reload} />
      ) : !result.data ? (
        <LoadingState label="Loading archive item…" />
      ) : (
        <ItemContent
          key={itemId}
          {...result.data}
          userId={userId}
          repository={repository}
          reload={result.reload}
        />
      )}
    </Screen>
  );
}

type LoadedItem = Awaited<ReturnType<ArchiveRepository['item']>>;

function ItemContent({
  item,
  context,
  repository,
  userId,
  reload,
}: {
  item: LoadedItem;
  context: ArchiveContextData;
  repository: ArchiveRepository;
  userId: string;
  reload: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const deletion = useSave();
  const date = formatHistoricalDate(item.recorded_on, item.date_precision);
  const canRemove =
    context.role === 'owner' ||
    (context.role === 'editor' && item.uploaded_by === userId);
  const fields = [
    ['Description', item.description],
    ['Date', date && (item.date_approximate ? `About ${date}` : date)],
    ['Location', item.location],
    ['Collection', item.collection],
    [
      'Event',
      context.events.find((event) => event.id === item.event_id)?.title,
    ],
    ['Source information', item.source_note],
  ];

  return (
    <>
      <PageHeading title={item.title} description={item.file_name} />
      <Preview repository={repository} item={item} />
      <Card>
        <Type variant="heading" accessibilityRole="header">
          Archive details
        </Type>
        {fields
          .filter(([, value]) => Boolean(value))
          .map(([label, value]) => (
            <View key={label} style={{ gap: 3 }}>
              <Type variant="label" tone="muted">
                {label}
              </Type>
              <Type>{value}</Type>
            </View>
          ))}
        <Type variant="label">Family members</Type>
        {item.archive_item_people.length ? (
          item.archive_item_people.map(({ person_id }) => (
            <ActionLink
              key={person_id}
              href={{
                pathname: '/family-tree/[personId]',
                params: { personId: person_id },
              }}
              label={
                context.people.find((person) => person.id === person_id)
                  ?.display_name ?? 'Family member'
              }
              variant="quiet"
            />
          ))
        ) : (
          <Type tone="muted">No family members linked.</Type>
        )}
        <Type variant="detail" tone="muted">
          Uploaded{' '}
          {item.uploaded_by === userId
            ? 'by you'
            : item.uploaded_by
              ? 'by a tree member'
              : 'by a former account'}{' '}
          · {new Date(item.created_at).toLocaleDateString()}
        </Type>
        <Type variant="detail" tone="muted">
          Last updated{' '}
          {item.updated_by === userId
            ? 'by you'
            : item.updated_by
              ? 'by a tree member'
              : 'by a former account'}{' '}
          · {new Date(item.updated_at).toLocaleDateString()}
        </Type>
        {context.canEdit && (
          <Button
            label={editing ? 'Close editing' : 'Edit details'}
            variant="secondary"
            onPress={() => setEditing(!editing)}
          />
        )}
        {canRemove && (
          <Button
            label="Remove file"
            variant="quiet"
            onPress={() => {
              setMessage('');
              setConfirm(true);
            }}
          />
        )}
      </Card>
      {editing && (
        <Editor
          item={item}
          context={context}
          repository={repository}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
      <Dialog
        open={confirm}
        title="Remove this archive file?"
        onClose={() => setConfirm(false)}
      >
        <Type>
          This removes the file, previews, and associated people from the
          visible archive.
        </Type>
        {message && (
          <Type tone="danger" accessibilityRole="alert">
            {message}
          </Type>
        )}
        <Button
          label={deletion.saving ? 'Removing…' : 'Confirm removal'}
          disabled={deletion.saving}
          onPress={() => {
            void deletion.save(
              async () => {
                try {
                  await repository.remove(item.id);
                } catch (error) {
                  setMessage(await archiveError(error));
                  throw error;
                }
              },
              () =>
                router.dismissTo({
                  pathname: '/family-archive',
                  params: { treeId: item.tree_id },
                }),
            );
          }}
        />
      </Dialog>
    </>
  );
}

function Preview({
  item,
  repository,
}: {
  item: ArchiveItem;
  repository: ArchiveRepository;
}) {
  const image = item.mime_type.startsWith('image/');
  const text = item.mime_type === 'text/plain';
  const read = useCallback(async () => {
    if (image)
      return {
        uri: await repository.signed(item.preview_path ?? item.object_path),
      };
    if (text) {
      const response = await fetch(await repository.signed(item.object_path));
      if (!response.ok) throw new Error('Preview unavailable');
      const content = await response.text();
      return {
        text:
          content.slice(0, 30_000) +
          (content.length > 30_000 ? '\n… Preview truncated.' : ''),
      };
    }
    return {};
  }, [image, item.object_path, item.preview_path, repository, text]);
  const preview = usePeopleQuery(read);
  const request = useSave();
  const [imageError, setImageError] = useState(false);
  return (
    <Card>
      <Type variant="heading" accessibilityRole="header">
        Preview
      </Type>
      {(preview.error || imageError) && (
        <ErrorState
          message="Couldn’t load the preview."
          onRetry={() => {
            setImageError(false);
            preview.reload();
          }}
        />
      )}
      {(image || text) && !preview.data && !preview.error && (
        <LoadingState label="Loading preview…" />
      )}
      {preview.data?.uri && !imageError && (
        <Image
          source={{ uri: preview.data.uri }}
          accessibilityLabel={item.title}
          style={{ width: '100%', height: 320 }}
          resizeMode="contain"
          onError={() => setImageError(true)}
        />
      )}
      {preview.data?.text !== undefined && (
        <Type selectable>{preview.data.text}</Type>
      )}
      {item.mime_type === 'application/pdf' && (
        <Button
          label="Open PDF preview"
          variant="secondary"
          disabled={request.saving}
          onPress={() =>
            void request.save(
              async () =>
                openPdfPreview(await repository.signed(item.object_path)),
              () => undefined,
            )
          }
        />
      )}
      <Button
        label={request.saving ? 'Opening file…' : 'Download original'}
        disabled={request.saving}
        onPress={() =>
          void request.save(
            async () =>
              downloadArchiveFile(
                await repository.signed(item.object_path, item.file_name),
                item.file_name,
                item.mime_type,
              ),
            () => undefined,
          )
        }
      />
      {request.error && (
        <Type tone="danger" accessibilityRole="alert">
          Couldn’t open the file. Try again to request a fresh download.
        </Type>
      )}
    </Card>
  );
}

function Editor({
  item,
  context,
  repository,
  onSaved,
}: {
  item: LoadedItem;
  context: ArchiveContextData;
  repository: ArchiveRepository;
  onSaved: () => void;
}) {
  const [values, setValues] = useState(() =>
    archiveDefaults(
      item,
      item.archive_item_people.map((link) => link.person_id),
    ),
  );
  const [submitted, setSubmitted] = useState(false);
  const parsed = archiveSchema.safeParse(values);
  const errors =
    submitted && !parsed.success
      ? z.flattenError(parsed.error).fieldErrors
      : {};
  const save = useSave();

  return (
    <Card>
      <Type variant="heading" accessibilityRole="header">
        Edit archive details
      </Type>
      <ArchiveForm
        value={values}
        onChange={setValues}
        context={context}
        errors={errors}
        createEvent={(title) => repository.createEvent(item.tree_id, title)}
      />
      {save.error && (
        <Type tone="danger" accessibilityRole="alert">
          Couldn’t save the changes. Check your access and try again.
        </Type>
      )}
      <Button
        label={save.saving ? 'Saving…' : 'Save changes'}
        disabled={save.saving}
        onPress={() => {
          setSubmitted(true);
          if (parsed.success)
            void save.save(
              () => repository.update(item.id, parsed.data),
              onSaved,
            );
        }}
      />
    </Card>
  );
}
