import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { Tabs } from '@/components/Tabs';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { useAuth } from '@/features/auth/AuthProvider';
import { BackendAccount } from '@/features/backend/BackendAccount';
import { useFamily } from '@/features/family/useFamily';
import { Choices } from '@/features/people/Choices';
import { useTheme } from '@/hooks/useTheme';
import {
  createAccountRepository,
  defaultPreferences,
  languages,
  type Language,
  type UserPreferences,
} from '@/services/accountRepository';

export default function SettingsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { workspace, setWorkspace } = useFamily();
  const { preference, setPreference } = useTheme();

  const isConnected = auth.kind === 'ready' && auth.session && auth.client;
  const client = isConnected ? auth.client : undefined;
  const user = isConnected ? auth.session?.user : undefined;
  const profile = auth.kind === 'ready' ? auth.account?.profile : undefined;

  // Profile fields
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [preferredLang, setPreferredLang] = useState<Language>(
    (profile?.preferred_language as Language) ?? 'en',
  );

  // Notification & Privacy Preferences
  const [preferences, setPreferences] =
    useState<Omit<UserPreferences, 'user_id'>>(defaultPreferences);
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Export & Deletion
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load preferences
  useEffect(() => {
    if (!client || !user) return;
    let mounted = true;
    async function load() {
      setLoadingPrefs(true);
      try {
        const acc = await createAccountRepository(client!).read(user!.id);
        if (mounted) {
          if (acc.preferences) {
            setPreferences(acc.preferences);
          }
          if (acc.profile) {
            setDisplayName(acc.profile.display_name);
            setPreferredLang(
              (acc.profile.preferred_language as Language) ?? 'en',
            );
          }
        }
      } catch {
        // ignore load errors
      } finally {
        if (mounted) setLoadingPrefs(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [client, user]);

  // Save profile and preferences
  async function handleSaveSettings() {
    if (!client || !user) return;
    setSavingSettings(true);
    setStatusMessage('');
    setErrorMessage('');
    try {
      const repo = createAccountRepository(client);
      await Promise.all([
        repo.updateProfile(user.id, displayName.trim(), preferredLang),
        repo.updatePreferences(user.id, preferences),
      ]);
      auth.reload();
      setStatusMessage('Settings saved successfully.');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to save settings.',
      );
    } finally {
      setSavingSettings(false);
    }
  }

  // Export personal data
  async function handleExportData() {
    if (!client) return;
    setIsExporting(true);
    setStatusMessage('');
    setErrorMessage('');
    try {
      const repo = createAccountRepository(client);
      const data = await repo.exportData();
      const jsonStr = JSON.stringify(data, null, 2);

      if (Platform.OS === 'web') {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `familyroots-personal-data-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert(
          'Personal Data Exported',
          `Exported ${Object.keys(data).length} top-level record groups.`,
        );
      }
      setStatusMessage('Personal data exported successfully.');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Data export failed.',
      );
    } finally {
      setIsExporting(false);
    }
  }

  // Delete account according to documented ownership & retention rules
  async function handleDeleteAccount() {
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') {
      setErrorMessage('Please type "DELETE" to confirm account deletion.');
      return;
    }

    if (!client) return;
    setIsDeleting(true);
    setErrorMessage('');
    try {
      const repo = createAccountRepository(client);
      await repo.deleteAccount();
      await client.auth.signOut({ scope: 'local' });
      auth.reload();
      router.replace('/');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to delete account. Try again.',
      );
      setIsDeleting(false);
    }
  }

  return (
    <Screen>
      <PageHeading
        title="Settings & Preferences"
        description="Manage your profile, preferred language, theme appearance, notifications, privacy, and account data."
      />

      {statusMessage ? (
        <Card>
          <Type tone="accent">✓ {statusMessage}</Type>
        </Card>
      ) : null}

      {errorMessage ? <ErrorState message={errorMessage} /> : null}

      {/* 1. Profile & Language Information */}
      {isConnected && (
        <Card>
          <Type variant="heading" accessibilityRole="header">
            Profile Information
          </Type>
          <Type tone="muted">
            Customize your display name and preferred language across the
            application.
          </Type>

          <View style={{ marginTop: 12, gap: 12 }}>
            {user?.email && <Type tone="muted">Email: {user.email}</Type>}

            <TextField
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={120}
            />

            <Choices
              label="Preferred language"
              value={preferredLang}
              choices={languages.map((l) => ({
                value: l.value,
                label: l.label,
              }))}
              onChange={(val) => setPreferredLang(val as Language)}
            />
          </View>
        </Card>
      )}

      {/* 2. Appearance */}
      <Card>
        <Type variant="heading" accessibilityRole="header">
          Appearance
        </Type>
        <Tabs
          label="Appearance"
          value={preference}
          onChange={setPreference}
          items={[
            {
              value: 'system',
              label: 'System',
              content: (
                <Type tone="muted">Follow your device’s color scheme.</Type>
              ),
            },
            {
              value: 'light',
              label: 'Light',
              content: <Type tone="muted">Use the light theme.</Type>,
            },
            {
              value: 'dark',
              label: 'Dark',
              content: <Type tone="muted">Use the dark theme.</Type>,
            },
          ]}
        />
      </Card>

      {/* 3. Notification Preferences */}
      {isConnected && (
        <Card>
          <Type variant="heading" accessibilityRole="header">
            Notification Preferences
          </Type>
          <Type tone="muted">
            Control which notifications you receive and via which delivery
            channels. Sensitive family information is always redacted in push
            previews.
          </Type>

          <View style={{ marginTop: 12, gap: 10 }}>
            <Type variant="label">Delivery Channels</Type>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button
                label={`In-App Notification Center: Always On`}
                variant="secondary"
                disabled
              />
              <Button
                label={`Email Notifications: ${preferences.notify_email ? 'Enabled' : 'Disabled'}`}
                variant="secondary"
                selected={preferences.notify_email}
                onPress={() =>
                  setPreferences((p) => ({
                    ...p,
                    notify_email: !p.notify_email,
                  }))
                }
              />
              <Button
                label={`Push Notifications: ${preferences.notify_push ? 'Enabled' : 'Disabled'}`}
                variant="secondary"
                selected={preferences.notify_push}
                onPress={() =>
                  setPreferences((p) => ({
                    ...p,
                    notify_push: !p.notify_push,
                  }))
                }
              />
            </View>

            <Type variant="label" style={{ marginTop: 8 }}>
              Notification Categories
            </Type>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button
                label={`Family Invitations: ${preferences.notify_invitations ? '✓ On' : 'Off'}`}
                variant="secondary"
                selected={preferences.notify_invitations}
                onPress={() =>
                  setPreferences((p) => ({
                    ...p,
                    notify_invitations: !p.notify_invitations,
                  }))
                }
              />
              <Button
                label={`Proposed Corrections: ${preferences.notify_corrections ? '✓ On' : 'Off'}`}
                variant="secondary"
                selected={preferences.notify_corrections}
                onPress={() =>
                  setPreferences((p) => ({
                    ...p,
                    notify_corrections: !p.notify_corrections,
                  }))
                }
              />
              <Button
                label={`Collaboration Updates: ${preferences.notify_collaboration ? '✓ On' : 'Off'}`}
                variant="secondary"
                selected={preferences.notify_collaboration}
                onPress={() =>
                  setPreferences((p) => ({
                    ...p,
                    notify_collaboration: !p.notify_collaboration,
                  }))
                }
              />
              <Button
                label={`Book Generation: ${preferences.notify_books ? '✓ On' : 'Off'}`}
                variant="secondary"
                selected={preferences.notify_books}
                onPress={() =>
                  setPreferences((p) => ({
                    ...p,
                    notify_books: !p.notify_books,
                  }))
                }
              />
              <Button
                label={`Job Failure Notices: ${preferences.notify_failures ? '✓ On' : 'Off'}`}
                variant="secondary"
                selected={preferences.notify_failures}
                onPress={() =>
                  setPreferences((p) => ({
                    ...p,
                    notify_failures: !p.notify_failures,
                  }))
                }
              />
            </View>
          </View>
        </Card>
      )}

      {/* 4. Privacy Preferences */}
      {isConnected && (
        <Card>
          <Type variant="heading" accessibilityRole="header">
            Privacy Preferences
          </Type>
          <Type tone="muted">
            Configure default privacy visibility and protection for living
            relatives.
          </Type>

          <View style={{ marginTop: 12, gap: 10 }}>
            <Choices
              label="Profile visibility"
              value={preferences.privacy_profile_visibility}
              choices={[
                { value: 'private', label: 'Private (Only Me)' },
                { value: 'members', label: 'Tree Members Only' },
                { value: 'public', label: 'Public' },
              ]}
              onChange={(val) =>
                setPreferences((p) => ({
                  ...p,
                  privacy_profile_visibility: val as any,
                }))
              }
            />

            <Button
              label={`Hide living relatives in shared views: ${preferences.privacy_hide_living ? 'Enabled (Recommended)' : 'Disabled'}`}
              variant="secondary"
              selected={preferences.privacy_hide_living}
              onPress={() =>
                setPreferences((p) => ({
                  ...p,
                  privacy_hide_living: !p.privacy_hide_living,
                }))
              }
            />
          </View>
        </Card>
      )}

      {/* Save Settings Button */}
      {isConnected && (
        <Button
          label={savingSettings ? 'Saving settings…' : 'Save all settings'}
          variant="primary"
          disabled={savingSettings || !displayName.trim()}
          onPress={() => void handleSaveSettings()}
        />
      )}

      {/* 5. Family Tree Permissions & Connected Trees */}
      <BackendAccount />

      {/* 6. Demo Workspace */}
      <Card>
        <Type variant="heading" accessibilityRole="header">
          Demo workspace
        </Type>
        <Tabs
          label="Demo workspace"
          value={workspace}
          onChange={setWorkspace}
          items={[
            {
              value: 'sample',
              label: 'Sample family',
              content: (
                <Type tone="muted">
                  Explore a fictional family with sample relatives and
                  milestones.
                </Type>
              ),
            },
            {
              value: 'empty',
              label: 'Empty family',
              content: (
                <Type tone="muted">
                  Start a separate family from scratch. Changes in both
                  workspaces last until the app reloads.
                </Type>
              ),
            },
          ]}
        />
      </Card>

      {/* 7. Data Portability & Personal Data Export */}
      {isConnected && (
        <Card>
          <Type variant="heading" accessibilityRole="header">
            Data Portability
          </Type>
          <Type tone="muted">
            Export a full JSON archive of your personal profile, tree
            memberships, notification history, book drafts, and preferences.
          </Type>
          <View style={{ marginTop: 12 }}>
            <Button
              label={
                isExporting ? 'Exporting data…' : 'Export personal data (JSON)'
              }
              variant="secondary"
              disabled={isExporting}
              onPress={() => void handleExportData()}
            />
          </View>
        </Card>
      )}

      {/* 8. Danger Zone: Delete Account */}
      {isConnected && (
        <Card>
          <Type
            variant="heading"
            accessibilityRole="header"
            style={{ color: '#A32A2A' }}
          >
            Delete Account
          </Type>
          <Type tone="muted">
            According to ownership & retention rules: If you own a tree with
            other members, ownership is automatically transferred to the next
            active editor. Trees where you are the sole member, along with your
            books, notifications, preferences, and profile, are permanently
            deleted.
          </Type>

          {!showDeleteConfirm ? (
            <View style={{ marginTop: 12 }}>
              <Button
                label="Delete my account…"
                variant="quiet"
                onPress={() => setShowDeleteConfirm(true)}
              />
            </View>
          ) : (
            <View
              style={{
                marginTop: 12,
                gap: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: '#A32A2A',
                borderRadius: 8,
              }}
            >
              <Type style={{ color: '#A32A2A', fontWeight: 'bold' }}>
                Are you absolutely sure? This action cannot be undone.
              </Type>
              <TextField
                label="Type DELETE to confirm"
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  label={isDeleting ? 'Deleting account…' : 'Confirm Delete'}
                  variant="primary"
                  disabled={
                    isDeleting ||
                    deleteConfirmText.trim().toLowerCase() !== 'delete'
                  }
                  onPress={() => void handleDeleteAccount()}
                />
                <Button
                  label="Cancel"
                  variant="quiet"
                  onPress={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                />
              </View>
            </View>
          )}
        </Card>
      )}

      {__DEV__ && (
        <Link href="/showcase" asChild>
          <Button label="Component showcase" variant="secondary" icon="grid" />
        </Link>
      )}
      <Link href="/" asChild>
        <Button variant="quiet" label="Back to home" />
      </Link>
    </Screen>
  );
}
