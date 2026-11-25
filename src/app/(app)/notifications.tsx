import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { NotificationCenter } from '@/features/notifications/NotificationCenter';

export default function NotificationsScreen() {
  return (
    <Screen>
      <PageHeading
        title="Notifications"
        description="Stay updated on invitations, proposed corrections, collaboration updates, and books."
      />
      <NotificationCenter />
    </Screen>
  );
}
