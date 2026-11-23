import { View } from 'react-native';

import { ActionLink } from '@/components/ActionLink';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { State } from '@/components/State';
import { Type } from '@/components/Type';
import { useAuth } from '@/features/auth/AuthProvider';
import { summarizeFamily } from '@/features/family/familySummary';
import { PersonList } from '@/features/family/PersonList';
import { useFamily } from '@/features/family/useFamily';
import { FamilyIllustration } from '@/features/foundation/FamilyIllustration';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/hooks/useTheme';

export function WelcomeScreen() {
  const { theme } = useTheme();
  const { desktop } = useLayout();
  const { snapshot } = useFamily();
  const { account } = useAuth();
  const { memberCount, generationCount, recentPeople, timeline, activity } =
    summarizeFamily(snapshot);

  return (
    <Screen>
      <View
        style={{
          borderRadius: theme.borders.hero,
          backgroundColor: theme.brand.forest,
          padding: desktop ? 36 : 22,
          gap: 16,
          flexDirection: desktop ? 'row' : 'column',
          alignItems: desktop ? 'center' : 'stretch',
        }}
      >
        <View
          style={{ flex: desktop ? 1.25 : undefined, minWidth: 0, gap: 12 }}
        >
          <Type
            variant="display"
            accessibilityRole="header"
            aria-level={1}
            style={{
              color: theme.brand.ivory,
              fontSize: desktop ? 47 : 34,
              lineHeight: desktop ? 54 : 40,
            }}
          >
            Welcome, {account?.profile.display_name || snapshot.profileName}
          </Type>
          <Type style={{ color: '#E0EAE3' }}>
            {memberCount
              ? 'Pick up where you left off and keep your family’s story growing.'
              : 'Start with yourself or someone whose story you know well.'}
          </Type>
        </View>
        {desktop && (
          <View style={{ flex: 1, maxWidth: 280, height: 150 }}>
            <FamilyIllustration />
          </View>
        )}
      </View>

      {account?.treeId && (
        <>
          <Card>
            <Type variant="heading" accessibilityRole="header">
              Connected family tree
            </Type>
            {account.treeName && <Type>{account.treeName}</Type>}
            <ActionLink
              href="/settings"
              label="View connected family trees"
              variant="secondary"
            />
          </Card>
          <Type variant="heading" accessibilityRole="header">
            Demo workspace
          </Type>
        </>
      )}

      {memberCount === 0 && (
        <Card>
          <State
            kind="empty"
            title="Start your family tree"
            message="Add one person to begin. A name and generation are enough. Add a birth year whenever you know it."
          />
          <ActionLink
            href="/family-tree/add"
            label="Add your first person"
            icon="add"
          />
        </Card>
      )}

      <View style={{ flexDirection: desktop ? 'row' : 'column', gap: 16 }}>
        <Card style={{ flex: desktop ? 1 : undefined }}>
          <Type variant="heading" accessibilityRole="header">
            Family overview
          </Type>
          <Type tone="muted">{snapshot.familyName}</Type>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[
              [memberCount, 'Family members'],
              [generationCount, 'Generations'],
            ].map(([value, label]) => (
              <View
                key={label}
                style={{
                  flex: 1,
                  minWidth: 0,
                  borderRadius: 12,
                  backgroundColor: theme.colors.subtle,
                  padding: 12,
                }}
              >
                <Type variant="title">{value}</Type>
                <Type variant="detail" tone="muted">
                  {label}
                </Type>
              </View>
            ))}
          </View>
        </Card>
        <Card style={{ flex: desktop ? 1 : undefined }}>
          <Type variant="heading" accessibilityRole="header">
            Quick actions
          </Type>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <ActionLink href="/family-tree/add" label="Add Person" icon="add" />
            <ActionLink
              href="/family-tree"
              label="View Tree"
              variant="secondary"
              icon="tree"
            />
            <ActionLink
              href="/family-archive/upload"
              label="Upload Memory"
              variant="secondary"
              icon="upload"
            />
            <ActionLink
              href="/my-books/create"
              label="Create Book"
              variant="secondary"
              icon="book"
            />
          </View>
        </Card>
      </View>

      <View style={{ flexDirection: desktop ? 'row' : 'column', gap: 16 }}>
        <Card style={{ flex: desktop ? 1 : undefined }}>
          <Type variant="heading" accessibilityRole="header">
            Recently added relatives
          </Type>
          {recentPeople.length ? (
            <PersonList people={recentPeople} />
          ) : (
            <Type tone="muted">
              People you add to the tree will appear here.
            </Type>
          )}
        </Card>
        <Card style={{ flex: desktop ? 1 : undefined }}>
          <Type variant="heading" accessibilityRole="header">
            Family history timeline
          </Type>
          {timeline.length ? (
            timeline.map((event) => (
              <View key={event.id} style={{ flexDirection: 'row', gap: 12 }}>
                <Type variant="label" tone="accent">
                  {event.year}
                </Type>
                <Type style={{ flex: 1, minWidth: 0 }}>{event.label}</Type>
              </View>
            ))
          ) : (
            <Type tone="muted">
              Add birth years to start your family timeline.
            </Type>
          )}
        </Card>
      </View>

      <Card>
        <Type variant="heading" accessibilityRole="header">
          Recent activity
        </Type>
        {activity.length ? (
          activity.map((entry) => (
            <View key={entry.id} style={{ gap: 2 }}>
              <Type>{entry.label}</Type>
              <Type variant="detail" tone="muted">
                {new Date(entry.createdAt).toLocaleDateString(undefined, {
                  dateStyle: 'medium',
                })}
              </Type>
            </View>
          ))
        ) : (
          <Type tone="muted">
            New relatives, memories, and book drafts will be listed here.
          </Type>
        )}
      </Card>
    </Screen>
  );
}
