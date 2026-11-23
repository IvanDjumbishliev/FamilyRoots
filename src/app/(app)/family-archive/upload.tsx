import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { Card } from '@/components/Card';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { Type } from '@/components/Type';
import { FormActions } from '@/features/family/FormActions';
import { MemoryFileField } from '@/features/family/MemoryFileField';
import type { MemoryFile } from '@/features/family/memoryFile';
import { useFamily } from '@/features/family/useFamily';
import { useSave } from '@/features/family/useSave';

import { ArchiveUpload } from '@/features/archive/ArchiveUpload';
import { useArchive } from '@/features/archive/useArchive';
import { isRecordId } from '@/services/peopleRepository';

export default function UploadMemoryScreen() {
  const { repository, treeId: firstTree } = useArchive();
  const { treeId } = useLocalSearchParams<{ treeId?: string }>();
  const tree = isRecordId(treeId) ? treeId : firstTree;
  return repository && tree ? (
    <ArchiveUpload repository={repository} treeId={tree} />
  ) : (
    <DemoUpload />
  );
}

function DemoUpload() {
  const { repository, workspace } = useFamily();
  const router = useRouter();
  const { save, saving, error } = useSave();
  const [file, setFile] = useState<MemoryFile>();
  const [fileError, setFileError] = useState('');

  function submit() {
    if (!file) return setFileError('Choose a file before saving.');
    void save(
      () =>
        repository.addMemory(workspace, {
          name: file.name,
          mimeType: file.mimeType,
          uri: file.getUri(),
        }),
      () => router.dismissTo('/family-archive'),
    );
  }

  return (
    <Screen>
      <PageHeading
        title="Upload Memory"
        description="Add a photo, document, or recording to your local archive for this session."
      />
      <Card>
        <Type tone="muted">
          Photos, PDF, TXT, MP3, M4A, and MP4 up to 10 MB.
        </Type>
        <MemoryFileField
          file={file}
          onFile={(selected) => {
            setFile(selected);
            setFileError('');
          }}
          onError={(message) => {
            setFile(undefined);
            setFileError(message);
          }}
        />
        {fileError && (
          <Type tone="danger" accessibilityRole="alert">
            {fileError}
          </Type>
        )}
        <FormActions
          cancelTo="/family-archive"
          label="Save memory"
          onSubmit={submit}
          saving={saving}
          error={error}
        />
      </Card>
    </Screen>
  );
}
