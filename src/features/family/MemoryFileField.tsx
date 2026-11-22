import * as DocumentPicker from 'expo-document-picker';

import { Button } from '@/components/Button';
import { Type } from '@/components/Type';
import {
  memoryMimeTypes,
  validateMemoryFile,
  type MemoryFileFieldProps,
} from '@/features/family/memoryFile';

export function MemoryFileField({
  file,
  onFile,
  onError,
}: MemoryFileFieldProps) {
  async function pick() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: memoryMimeTypes,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mimeType = validateMemoryFile(
        asset.name,
        asset.mimeType,
        asset.size,
      );
      onFile({ name: asset.name, mimeType, getUri: () => asset.uri });
    } catch (error) {
      onError(
        error instanceof Error ? error.message : 'Couldn’t open that file.',
      );
    }
  }

  return (
    <>
      <Button
        label={file ? 'Choose another file' : 'Choose a file'}
        variant="secondary"
        icon="upload"
        onPress={() => void pick()}
      />
      {file && <Type accessibilityLiveRegion="polite">{file.name}</Type>}
    </>
  );
}
