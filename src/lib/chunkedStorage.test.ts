import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createChunkedStorage } from './chunkedStorage';

test('round-trips a multi-chunk unicode session and removes it at logout', async () => {
  const values = new Map<string, string>();
  const storage = createChunkedStorage({
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      assert.ok(Buffer.byteLength(value, 'utf8') <= 2048);
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  });
  const original = '🌳'.repeat(1200);
  await storage.setItem('session', original);
  assert.equal(await storage.getItem('session'), original);
  await storage.setItem('session', 'replacement');
  assert.equal(await storage.getItem('session'), 'replacement');
  await storage.removeItem('session');
  assert.equal(await storage.getItem('session'), null);
  assert.equal(values.size, 0);
});

test('keeps the previous session if committing its replacement fails', async () => {
  const values = new Map<string, string>();
  let fail = false;
  const storage = createChunkedStorage({
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      if (fail && key === 'session')
        throw new Error('Secure storage unavailable');
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  });
  await storage.setItem('session', 'original');
  fail = true;
  await assert.rejects(storage.setItem('session', 'replacement'));
  assert.equal(await storage.getItem('session'), 'original');
});
