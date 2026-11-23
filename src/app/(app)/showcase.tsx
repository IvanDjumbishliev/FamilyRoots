import { Redirect } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { Screen } from '@/components/Screen';
import { State } from '@/components/State';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { useLayout } from '@/hooks/useLayout';

export default function ShowcaseScreen() {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [open, setOpen] = useState(false);
  const { tablet } = useLayout();
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <Screen>
      <Type variant="title" accessibilityRole="header" aria-level={1}>
        Component showcase
      </Type>
      <View
        style={{
          flexDirection: tablet ? 'row' : 'column',
          alignItems: tablet ? 'flex-start' : 'stretch',
          gap: 16,
        }}
      >
        <Card style={{ flex: tablet ? 1 : undefined }}>
          <Type variant="heading" accessibilityRole="header">
            Controls and validation
          </Type>
          <TextField
            label="Family name"
            value={name}
            onChangeText={setName}
            hint="Enter a name to try validation."
            error={
              submitted && !name.trim() ? 'Enter a family name.' : undefined
            }
            onSubmitEditing={() => setSubmitted(true)}
            submitBehavior="submit"
            blurOnSubmit={false}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button label="Validate" onPress={() => setSubmitted(true)} />
            <Button
              label="Open dialog"
              variant="secondary"
              onPress={() => setOpen(true)}
            />
            <Button label="Disabled" disabled />
          </View>
          {submitted && Boolean(name.trim()) && (
            <State kind="success" title="Name looks good" />
          )}
        </Card>
        <Card style={{ flex: tablet ? 1 : undefined }}>
          <Type variant="heading" accessibilityRole="header">
            Status states
          </Type>
          <State
            kind="empty"
            title="No records yet"
            message="Records will appear when you add them."
          />
          <LoadingState label="Loading records…" />
          <State kind="success" title="Record saved" />
          <ErrorState message="The record could not be loaded." />
        </Card>
      </View>
      <Dialog open={open} title="Example dialog" onClose={() => setOpen(false)}>
        <Type tone="muted">Close this dialog to return to the showcase.</Type>
      </Dialog>
    </Screen>
  );
}
