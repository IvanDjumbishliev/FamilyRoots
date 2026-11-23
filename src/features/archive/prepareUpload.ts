import { Image } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { MemoryFile } from '@/features/family/memoryFile';

import {
  archiveMimeTypes,
  serializeArchiveMetadata,
  type ArchiveMetadata,
} from './archiveMetadata';
import { readImageResult } from './imageFile';

function dimensions(uri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

async function resize(
  uri: string,
  width: number,
  height: number,
  longest: number,
  quality: number,
) {
  const image = ImageManipulator.manipulate(uri);
  const factor = Math.min(1, longest / Math.max(width, height));
  try {
    if (factor < 1)
      image.resize({
        width: Math.max(1, Math.floor(width * factor)),
        height: Math.max(1, Math.floor(height * factor)),
      });
    const rendered = await image.renderAsync();
    try {
      const saved = await rendered.saveAsync({
        compress: quality,
        format: SaveFormat.JPEG,
      });
      return await readImageResult(saved.uri);
    } finally {
      rendered.release();
    }
  } finally {
    image.release();
  }
}

function encodeUtf8(value: string) {
  // Hermes versions without TextEncoder still provide encodeURIComponent.
  const encoded = encodeURIComponent(
    value.replace(/[\uD800-\uDFFF]/gu, '\uFFFD'),
  );
  const bytes: number[] = [];
  for (let index = 0; index < encoded.length; index++) {
    if (encoded[index] === '%') {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else bytes.push(encoded.charCodeAt(index));
  }
  return Uint8Array.from(bytes);
}

export async function prepareArchiveUpload(
  file: MemoryFile,
  treeId: string,
  values: ArchiveMetadata,
) {
  if (!archiveMimeTypes.some((type) => type === file.mimeType))
    throw new Error('Choose a JPEG, PNG, PDF, or UTF-8 text file.');
  const original = await file.getBytes();
  if (!original.byteLength || original.byteLength > 10 * 1024 * 1024)
    throw new Error('Choose a non-empty file no larger than 10 MB.');
  let preview = new ArrayBuffer(0);
  let thumbnail = new ArrayBuffer(0);
  if (file.mimeType.startsWith('image/')) {
    const uri = file.getUri();
    try {
      const { width, height } = await dimensions(uri);
      if (
        !width ||
        !height ||
        Math.max(width, height) > 12000 ||
        width * height > 40_000_000
      ) {
        throw new Error('Choose an image no larger than 40 megapixels.');
      }
      preview = await resize(uri, width, height, 2000, 0.8);
      thumbnail = await resize(uri, width, height, 320, 0.72);
    } finally {
      if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
    }
  }
  const header = encodeUtf8(
    JSON.stringify({
      ...serializeArchiveMetadata(values),
      treeId,
      fileName: file.name,
      mime: file.mimeType,
      originalLength: original.byteLength,
      previewLength: preview.byteLength,
      thumbnailLength: thumbnail.byteLength,
    }),
  );
  if (header.length > 24 * 1024)
    throw new Error('Shorten the archive metadata and try again.');
  const bytes = new Uint8Array(
    4 +
      header.length +
      original.byteLength +
      preview.byteLength +
      thumbnail.byteLength,
  );
  new DataView(bytes.buffer).setUint32(0, header.length);
  bytes.set(header, 4);
  let offset = 4 + header.length;
  for (const part of [original, preview, thumbnail]) {
    bytes.set(new Uint8Array(part), offset);
    offset += part.byteLength;
  }
  return bytes.buffer;
}
