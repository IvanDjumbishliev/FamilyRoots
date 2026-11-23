import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decodeUpload, fileInfo, inspectFile } from './fileValidation';

const textEncoder = new TextEncoder();
test('rejects executable content claimed as an image or a broken document', () => {
  assert.equal(
    inspectFile(textEncoder.encode('<svg onload="alert(1)">'), 'image/png'),
    false,
  );
  assert.equal(
    inspectFile(textEncoder.encode('%PDF-1.7\n%%EOF'), 'application/pdf'),
    false,
  );
  assert.equal(inspectFile(new Uint8Array([0xff, 0xfe]), 'text/plain'), false);
  assert.equal(
    inspectFile(textEncoder.encode('A real family letter.\n'), 'text/plain'),
    true,
  );
});

test('sanitizes filenames and requires names and bytes to match the upload envelope', () => {
  assert.deepEqual(fileInfo('../a<letter>.TXT', 'text/plain'), {
    mime: 'text/plain',
    filename: 'a_letter_.txt',
  });
  assert.throws(() => fileInfo('image.svg', 'image/png'));
  const header = textEncoder.encode(
    JSON.stringify({
      treeId: '20000000-0000-4000-8000-000000000001',
      people: [],
      meta: { title: 'A letter' },
      fileName: 'letter.txt',
      mime: 'text/plain',
      originalLength: 4,
      previewLength: 0,
      thumbnailLength: 0,
    }),
  );
  const body = new Uint8Array(header.length + 8);
  new DataView(body.buffer).setUint32(0, header.length);
  body.set(header, 4);
  body.set(textEncoder.encode('test'), 4 + header.length);
  assert.equal(new TextDecoder().decode(decodeUpload(body).original), 'test');
  assert.throws(() => decodeUpload(body.subarray(0, -1)));
});
