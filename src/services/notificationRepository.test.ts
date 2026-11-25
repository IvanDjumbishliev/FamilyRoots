import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createNotificationRepository,
  notificationSchema,
  type AppNotification,
} from './notificationRepository';

test('validates notification schema across all required categories', () => {
  const categories = [
    'invitation',
    'correction',
    'collaboration',
    'book',
    'job_failure',
  ] as const;

  for (const cat of categories) {
    const notification: AppNotification = {
      id: `notif-${cat}`,
      user_id: 'user-1',
      tree_id: 'tree-1',
      category: cat,
      title: `${cat} notification`,
      body: 'Details here',
      link: '/some/link',
      metadata: {},
      read: false,
      created_at: new Date().toISOString(),
    };
    const parsed = notificationSchema.parse(notification);
    assert.equal(parsed.category, cat);
    assert.equal(parsed.read, false);
  }
});

test('notification repository handles list, unreadCount, and markAsRead', async () => {
  let updatedId = '';
  let updatedFields: Record<string, unknown> = {};

  const mockClient: any = {
    from: (table: string) => {
      assert.equal(table, 'notifications');
      return {
        select: (fields: string, opts?: any) => {
          if (opts?.head) {
            return {
              eq: (field: string, val: any) => ({
                count: 3,
                error: null,
              }),
            };
          }
          return {
            order: () => ({
              limit: async () => ({
                data: [
                  {
                    id: 'n-1',
                    user_id: 'u-1',
                    tree_id: 't-1',
                    category: 'invitation',
                    title: 'New invitation',
                    body: 'You were invited',
                    link: '/invitations',
                    metadata: {},
                    read: false,
                    created_at: '2026-11-25T10:00:00Z',
                  },
                ],
                error: null,
              }),
            }),
          };
        },
        update: (values: Record<string, unknown>) => ({
          eq: async (field: string, val: string) => {
            updatedFields = values;
            updatedId = val;
            return { error: null };
          },
        }),
      };
    },
  };

  const repo = createNotificationRepository(mockClient);
  const items = await repo.list();
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'New invitation');

  const count = await repo.unreadCount();
  assert.equal(count, 3);

  await repo.markAsRead('n-1');
  assert.equal(updatedId, 'n-1');
  assert.equal(updatedFields.read, true);
});
