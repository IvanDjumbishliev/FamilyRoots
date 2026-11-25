import { z } from 'zod';

import type { BackendClient } from '@/lib/supabase';

export const notificationCategory = z.enum([
  'invitation',
  'correction',
  'collaboration',
  'book',
  'job_failure',
]);

export type NotificationCategory = z.infer<typeof notificationCategory>;

export const notificationSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  tree_id: z.string().nullable(),
  category: notificationCategory,
  title: z.string(),
  body: z.string(),
  link: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).catch({}),
  read: z.boolean(),
  created_at: z.string(),
});

export type AppNotification = z.infer<typeof notificationSchema>;

export function createNotificationRepository(client: BackendClient) {
  return {
    async list(): Promise<AppNotification[]> {
      const { data, error } = await client
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return z.array(notificationSchema).parse(data ?? []);
    },

    async unreadCount(): Promise<number> {
      const { count, error } = await client
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('read', false);

      if (error) return 0;
      return count ?? 0;
    },

    async markAsRead(id: string): Promise<void> {
      const { error } = await client
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      if (error) throw error;
    },

    async markAllAsRead(): Promise<void> {
      const { error } = await client
        .from('notifications')
        .update({ read: true })
        .eq('read', false);

      if (error) throw error;
    },
  };
}

export type NotificationRepository = ReturnType<
  typeof createNotificationRepository
>;
