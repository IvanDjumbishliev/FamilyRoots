import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { State } from '@/components/State';
import { Type } from '@/components/Type';
import { useNotifications } from '@/features/notifications/useNotifications';
import type { NotificationCategory } from '@/services/notificationRepository';

const categoryLabels: Record<
  NotificationCategory,
  { icon: string; name: string }
> = {
  invitation: { icon: '✉️', name: 'Family Invitation' },
  correction: { icon: '📝', name: 'Proposed Correction' },
  collaboration: { icon: '👥', name: 'Collaboration Update' },
  book: { icon: '📖', name: 'Book Generation' },
  job_failure: { icon: '⚠️', name: 'System Notice' },
};

export function NotificationCenter() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    reload,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  return (
    <View style={{ gap: 16 }}>
      {/* Header and Actions Card */}
      <Card>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <View style={{ gap: 4 }}>
            <Type variant="heading">Notification Center</Type>
            <Type tone="muted">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'All caught up!'}
            </Type>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {unreadCount > 0 && (
              <Button
                label="Mark all read"
                variant="secondary"
                onPress={() => void markAllAsRead()}
              />
            )}
            <Button
              label="Refresh"
              variant="quiet"
              onPress={() => void reload()}
            />
          </View>
        </View>
      </Card>

      {/* Notifications List */}
      {loading && <LoadingState label="Loading notifications…" />}
      {error && <ErrorState message={error} onRetry={() => void reload()} />}

      {!loading && !error && notifications.length === 0 && (
        <State
          kind="empty"
          title="No notifications"
          message="You don’t have any notifications at this time. Updates regarding family invitations, books, and corrections will appear here."
        />
      )}

      {!loading && notifications.length > 0 && (
        <View style={{ gap: 12 }}>
          {notifications.map((n) => {
            const meta = categoryLabels[n.category] ?? {
              icon: '🔔',
              name: 'Notification',
            };

            return (
              <Card key={n.id}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Type style={{ fontSize: 16 }}>{meta.icon}</Type>
                      <Type variant="label" tone="muted">
                        {meta.name}
                      </Type>
                      {!n.read && (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: '#1E6B52',
                          }}
                        />
                      )}
                    </View>

                    <Type
                      variant="heading"
                      style={{
                        fontWeight: n.read ? 'normal' : 'bold',
                        fontSize: 16,
                      }}
                    >
                      {n.title}
                    </Type>

                    <Type tone="muted">{n.body}</Type>

                    <Type tone="muted" style={{ fontSize: 11, marginTop: 4 }}>
                      {new Date(n.created_at).toLocaleString()}
                    </Type>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    {n.link && (
                      <ActionLink
                        href={n.link as any}
                        label="Open"
                        variant="secondary"
                      />
                    )}

                    {!n.read && (
                      <Button
                        label="Mark read"
                        variant="quiet"
                        onPress={() => void markAsRead(n.id)}
                      />
                    )}
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </View>
  );
}
