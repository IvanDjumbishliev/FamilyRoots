import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import {
  createNotificationRepository,
  type AppNotification,
} from '@/services/notificationRepository';

export function useNotifications() {
  const auth = useAuth();
  const client =
    auth.kind === 'ready' && auth.session ? auth.client : undefined;

  const repository = useMemo(
    () => (client ? createNotificationRepository(client) : undefined),
    [client],
  );

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!repository) return;
    setLoading(true);
    setError('');
    try {
      const [list, count] = await Promise.all([
        repository.list(),
        repository.unreadCount(),
      ]);
      setNotifications(list);
      setUnreadCount(count);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load notifications.',
      );
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!repository) return;
      await repository.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    },
    [repository],
  );

  const markAllAsRead = useCallback(async () => {
    if (!repository) return;
    await repository.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [repository]);

  return {
    repository,
    notifications,
    unreadCount,
    loading,
    error,
    reload,
    markAsRead,
    markAllAsRead,
  };
}
