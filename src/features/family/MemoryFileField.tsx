import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { Button } from '@/components/Button';
import { Type } from '@/components/Type';
import {
  memoryMimeTypes,
  validateMemoryFile,
  imageMimeTypes,
  type MemoryFileFieldProps,
} from '@/features/family/memoryFile';

export function MemoryFileField({
  file,
  imagesOnly = false,
  allowedMimeTypes,
  onFile,
  onError,
}: MemoryFileFieldProps) {
  async function pick() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: allowedMimeTypes
          ? [...allowedMimeTypes]
          : imagesOnly
            ? imageMimeTypes
            : memoryMimeTypes,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mimeType = validateMemoryFile(
        asset.name,
        asset.mimeType,
        asset.size,
      );
      if (imagesOnly && !mimeType.startsWith('image/'))
        throw new Error('Choose a supported photograph.');
      if (allowedMimeTypes && !allowedMimeTypes.includes(mimeType))
        throw new Error('Choose a file supported by this archive.');
      onFile({
        name: asset.name,
        mimeType,
        getUri: () => asset.uri,
        getBytes: () => new File(asset.uri).arrayBuffer(),
      });
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
