export const MiB = 1024 * 1024;
export const maxOriginal = 10 * MiB;
export const maxPreview = 5 * MiB;
export const maxThumbnail = 512 * 1024;
export const maxHeader = 24 * 1024;
export const maxRequest =
  4 + maxHeader + maxOriginal + maxPreview + maxThumbnail;

export type FileType =
  | 'image/jpeg'
  | 'image/png'
  | 'application/pdf'
  | 'text/plain';

export class RequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function boundedBody(request: Request, limit: number) {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > limit)
    throw new RequestError(413, 'This upload is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, 'Missing request body.');
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new RequestError(413, 'This upload is too large.');
    }
    parts.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function matches(
  bytes: Uint8Array,
  offset: number,
  signature: readonly number[],
) {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function pngSize(bytes: Uint8Array) {
  if (
    !matches(bytes, 0, [137, 80, 78, 71, 13, 10, 26, 10]) ||
    bytes.length < 45
  )
    return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13 || !matches(bytes, 12, [73, 72, 68, 82]))
    return undefined;
  let offset = 8;
  let imageData = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return undefined;
    if (matches(bytes, offset + 4, [73, 68, 65, 84])) imageData = true;
    if (matches(bytes, offset + 4, [73, 69, 78, 68])) {
      return imageData && length === 0 && end === bytes.length
        ? { width: view.getUint32(16), height: view.getUint32(20) }
        : undefined;
    }
    offset = end;
  }
  return undefined;
}

function jpegSize(bytes: Uint8Array) {
  if (
    !matches(bytes, 0, [255, 216]) ||
    !matches(bytes, bytes.length - 2, [255, 217])
  )
    return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  let size: { width: number; height: number } | undefined;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 255) return undefined;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 218) return size;
    if (offset + 2 > bytes.length) return undefined;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) return undefined;
    if ([192, 193, 194].includes(marker)) {
      if (length < 8) return undefined;
      size = {
        height: view.getUint16(offset + 3),
        width: view.getUint16(offset + 5),
      };
    }
    offset += length;
  }
  return undefined;
}

export function inspectFile(
  bytes: Uint8Array,
  type: FileType,
  dimension = 12000,
) {
  if (type === 'image/jpeg' || type === 'image/png') {
    const size = type === 'image/jpeg' ? jpegSize(bytes) : pngSize(bytes);
    return Boolean(
      size &&
      size.width > 0 &&
      size.height > 0 &&
      size.width <= dimension &&
      size.height <= dimension &&
      size.width * size.height <= 40_000_000,
    );
  }
  if (type === 'application/pdf') {
    const decoder = new TextDecoder();
    if (
      !/^%PDF-(?:1\.[0-7]|2\.0)(?:\r|\n)/.test(
        decoder.decode(bytes.subarray(0, 12)),
      )
    )
      return false;
    const footer = /startxref[\t\r\n ]+(\d+)[\t\r\n ]+%%EOF[\t\r\n ]*$/.exec(
      decoder.decode(bytes.subarray(-2048)),
    );
    if (!footer) return false;
    const offset = Number(footer[1]);
    return (
      Number.isSafeInteger(offset) &&
      offset > 8 &&
      offset < bytes.length &&
      /^(?:xref\s|\d+\s+\d+\s+obj\b)/.test(
        decoder.decode(bytes.subarray(offset, offset + 40)),
      )
    );
  }
  if (type === 'text/plain') {
    try {
      return !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      );
    } catch {
      return false;
    }
  }
  return false;
}

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

const suffixes = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'application/pdf': ['pdf'],
  'text/plain': ['txt'],
};

export function fileInfo(name: unknown, type: unknown) {
  if (
    typeof name !== 'string' ||
    typeof type !== 'string' ||
    !Object.hasOwn(suffixes, type)
  ) {
    throw new RequestError(415, 'Choose a JPEG, PNG, PDF, or UTF-8 text file.');
  }
  const mime = type as FileType;
  const filename = (name.split(/[\\/]/).pop() ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} ._()-]/gu, '_')
    .replace(/^[ .]+/, '')
    .trim();
  const dot = filename.lastIndexOf('.');
  const extension = filename.slice(dot + 1).toLowerCase();
  if (dot < 1 || !suffixes[mime].includes(extension)) {
    throw new RequestError(
      415,
      'The filename and selected file type do not match.',
    );
  }
  return {
    mime,
    filename: filename.slice(0, dot).slice(0, 160) + '.' + extension,
  };
}

export function decodeUpload(body: Uint8Array) {
  if (body.length < 5) throw new RequestError(400, 'Invalid upload.');
  const length = new DataView(
    body.buffer,
    body.byteOffset,
    body.byteLength,
  ).getUint32(0);
  if (!length || length > maxHeader || body.length <= 4 + length)
    throw new RequestError(400, 'Invalid upload metadata.');
  let header: Record<string, unknown>;
  try {
    header = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        body.subarray(4, 4 + length),
      ),
    );
    if (!header || typeof header !== 'object' || Array.isArray(header))
      throw new Error();
  } catch {
    throw new RequestError(400, 'Invalid upload metadata.');
  }
  const {
    originalLength,
    previewLength,
    thumbnailLength,
    treeId,
    meta,
    people,
  } = header;
  if (
    !isUuid(treeId) ||
    !meta ||
    typeof meta !== 'object' ||
    Array.isArray(meta) ||
    !Array.isArray(people) ||
    people.length > 50 ||
    !people.every(isUuid) ||
    typeof originalLength !== 'number' ||
    !Number.isInteger(originalLength) ||
    originalLength < 1 ||
    originalLength > maxOriginal ||
    typeof previewLength !== 'number' ||
    !Number.isInteger(previewLength) ||
    previewLength < 0 ||
    previewLength > maxPreview ||
    typeof thumbnailLength !== 'number' ||
    !Number.isInteger(thumbnailLength) ||
    thumbnailLength < 0 ||
    thumbnailLength > maxThumbnail ||
    length + 4 + originalLength + previewLength + thumbnailLength !==
      body.length
  ) {
    throw new RequestError(400, 'Invalid upload size or metadata.');
  }
  const { mime, filename } = fileInfo(header.fileName, header.mime);
  const start = 4 + length;
  return {
    treeId,
    meta,
    people,
    mime,
    filename,
    original: body.subarray(start, start + originalLength),
    preview: body.subarray(
      start + originalLength,
      start + originalLength + previewLength,
    ),
    thumbnail: body.subarray(start + originalLength + previewLength),
  };
}
