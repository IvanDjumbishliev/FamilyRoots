export type MemoryFile = {
  name: string;
  mimeType: string;
  getBytes: () => Promise<ArrayBuffer>;
  getUri: () => string;
};

export type MemoryFileFieldProps = {
  file?: MemoryFile;
  imagesOnly?: boolean;
  allowedMimeTypes?: readonly string[];
  onFile: (file: MemoryFile) => void;
  onError: (error: string) => void;
};

const extensions = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  txt: 'text/plain',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
} as const;
export const acceptedMemoryExtensions = Object.keys(extensions)
  .map((extension) => `.${extension}`)
  .join(',');
export const memoryMimeTypes = [...new Set(Object.values(extensions))];

export function validateMemoryFile(
  name: string,
  mimeType?: string,
  size?: number,
) {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  const inferred = extensions[extension as keyof typeof extensions];
  const type =
    mimeType && mimeType !== 'application/octet-stream' ? mimeType : inferred;
  if (
    !inferred ||
    !type ||
    !memoryMimeTypes.some((allowed) => allowed === type)
  ) {
    throw new Error('Choose a supported photo, PDF, text, audio, or MP4 file.');
  }
  if (size === 0 || (size !== undefined && size > 10 * 1024 * 1024)) {
    throw new Error('Choose a non-empty file no larger than 10 MB.');
  }
  return type;
}

export const imageMimeTypes = memoryMimeTypes.filter((type) =>
  type.startsWith('image/'),
);
