import { useId, useRef } from 'react';

import { Button } from '@/components/Button';
import { Type } from '@/components/Type';
import {
  acceptedMemoryExtensions,
  validateMemoryFile,
  type MemoryFileFieldProps,
} from '@/features/family/memoryFile';

export function MemoryFileField({
  file,
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
        accept={acceptedMemoryExtensions}
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
            onFile({
              name: selected.name,
              mimeType,
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
