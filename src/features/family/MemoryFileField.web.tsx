import { useId, useRef } from 'react';

import { Button } from '@/components/Button';
import { Type } from '@/components/Type';
import {
  acceptedMemoryExtensions,
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
  const input = useRef<HTMLInputElement>(null);
  const label = useId();
  return (
    <>
      <input
        ref={input}
        hidden
        type="file"
        accept={
          allowedMimeTypes
            ? allowedMimeTypes.join(',')
            : imagesOnly
              ? imageMimeTypes.join(',')
              : acceptedMemoryExtensions
        }
        aria-labelledby={label}
        onChange={(event) => {
          const selected = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (!selected) return;
          try {
            const mimeType = validateMemoryFile(
              selected.name,
              selected.type,
              selected.size,
            );
            if (imagesOnly && !mimeType.startsWith('image/'))
              throw new Error('Choose a supported photograph.');
            if (allowedMimeTypes && !allowedMimeTypes.includes(mimeType))
              throw new Error('Choose a file supported by this archive.');
            onFile({
              name: selected.name,
              mimeType,
              getBytes: () => selected.arrayBuffer(),
              getUri: () => URL.createObjectURL(selected),
            });
          } catch (error) {
            onError(
              error instanceof Error
                ? error.message
                : 'Couldn’t open that file.',
            );
          }
        }}
      />
      <Button
        nativeID={label}
        label={file ? 'Choose another file' : 'Choose a file'}
        variant="secondary"
        icon="upload"
        onPress={() => input.current?.click()}
      />
      {file && <Type accessibilityLiveRegion="polite">{file.name}</Type>}
    </>
  );
}
