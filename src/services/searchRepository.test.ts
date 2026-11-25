import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createSearchRepository,
  searchItemSchema,
  type SearchItem,
} from './searchRepository';

test('validates search items and category types', () => {
  const item: SearchItem = {
    id: 'test-1',
    category: 'person',
    tree_id: 'tree-123',
    tree_name: 'Petrov Family',
    title: 'Mara Petrova',
    subtitle: 'Sofia',
    detail: 'Born 1882',
    link: '/family-tree/test-1',
    created_at: new Date().toISOString(),
  };

  const parsed = searchItemSchema.parse(item);
  assert.equal(parsed.title, 'Mara Petrova');
  assert.equal(parsed.category, 'person');
  assert.equal(parsed.link, '/family-tree/test-1');
});

test('search repository queries with filters and pagination limits', async () => {
  let calledRpc = '';
  let rpcArgs: Record<string, unknown> = {};

  const mockClient: any = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calledRpc = name;
      rpcArgs = args;
      return {
        data: [
          {
            id: 'item-1',
            category: 'book',
            tree_id: 'tree-1',
            tree_name: 'Demo Tree',
            title: 'Family Roots Book',
            subtitle: 'By John Doe',
            detail: 'Volume 1',
            link: '/my-books/item-1',
            created_at: '2026-11-25T12:00:00Z',
          },
        ],
        error: null,
      };
    },
  };

  const repo = createSearchRepository(mockClient);
  const results = await repo.search({
    query: 'roots',
    treeId: 'tree-1',
    category: 'books',
    limit: 10,
    offset: 20,
  });

  assert.equal(calledRpc, 'global_search');
  assert.equal(rpcArgs.p_query, 'roots');
  assert.equal(rpcArgs.p_tree_id, 'tree-1');
  assert.equal(rpcArgs.p_category, 'books');
  assert.equal(rpcArgs.p_limit, 10);
  assert.equal(rpcArgs.p_offset, 20);
  assert.equal(results.length, 1);
  assert.equal(results[0].category, 'book');
});

test('search repository returns empty array on empty query without making RPC', async () => {
  let called = false;
  const mockClient: any = {
    rpc: async () => {
      called = true;
      return { data: [], error: null };
    },
  };

  const repo = createSearchRepository(mockClient);
  const results = await repo.search({ query: '   ' });
  assert.equal(called, false);
  assert.deepEqual(results, []);
});
