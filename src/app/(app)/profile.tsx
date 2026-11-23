import { Redirect } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { RequestError } from '@/features/auth/AccountFields';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAuthRequest } from '@/features/auth/useAuthRequest';
import {
  createAccountRepository,
  languages,
  type Language,
} from '@/services/accountRepository';

export default function UserProfile() {
  const auth = useAuth();
  if (auth.kind !== 'ready' || !auth.session || !auth.account)
    return <Redirect href="/" />;
  const { client, session, account } = auth;
  const profile = account.profile;
  const language =
    languages.find((option) => option.value === profile.preferred_language)
      ?.value ?? 'en';
  return (
    <ProfileForm
      key={session.user.id}
      initialName={profile.display_name}
      initialLanguage={language}
      email={session.user.email}
      save={async (name, preference) => {
        await createAccountRepository(client).updateProfile(
          session.user.id,
          name,
          preference,
        );
        auth.reload();
      }}
      logout={async () => {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw error;
      }}
    />
  );
}

function ProfileForm({
  initialName,
  initialLanguage,
  email,
  save,
  logout,
}: {
  initialName: string;
  initialLanguage: Language;
  email?: string;
  save: (name: string, language: Language) => Promise<void>;
  logout: () => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [language, setLanguage] = useState(initialLanguage);
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const request = useAuthRequest();

  function submit() {
    setSubmitted(true);
    if (!name.trim()) return;
    void request.submit(
      'profile',
      1,
      async () => {
        await save(name.trim(), language);
        setSaved(true);
      },
      'Couldn’t save your profile. Check your connection and try again.',
    );
  }

  return (
    <Screen>
      <PageHeading title="User profile" />
      <Card>
        {email && <Type tone="muted">{email}</Type>}
        <TextField
          label="Display name"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setSaved(false);
          }}
          maxLength={120}
          error={
            submitted && !name.trim() ? 'Enter a display name.' : undefined
          }
        />
        <Type variant="label">Preferred language</Type>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {languages.map((option) => (
            <Button
              key={option.value}
              label={option.label}
              variant="secondary"
              accessibilityRole="radio"
              accessibilityState={{ checked: option.value === language }}
              aria-checked={option.value === language}
              selected={option.value === language}
              onPress={() => {
                setLanguage(option.value);
                setSaved(false);
              }}
            />
          ))}
        </View>
        <Type variant="detail" tone="muted">
          Saves your language preference. The current interface is in English.
        </Type>
        <RequestError message={request.message} />
        {saved && (
          <Type tone="success" accessibilityLiveRegion="polite">
            Profile saved.
          </Type>
        )}
        <Button label="Save profile" disabled={request.busy} onPress={submit} />
        <Button
          label="Log out"
          variant="quiet"
          disabled={request.busy}
          onPress={() =>
            void request.submit(
              'logout',
              2,
              logout,
              'Couldn’t log out. Try again.',
            )
          }
        />
      </Card>
    </Screen>
  );
}
