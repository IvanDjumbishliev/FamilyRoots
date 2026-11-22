import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { useSave } from '@/features/family/useSave';
import type { BackendClient } from '@/lib/supabase';
import {
  createSupabaseFamilyRepository,
  describeBackendError,
  type ConnectedFamilyRepository,
  type ConnectedTree,
} from '@/services/supabaseFamilyRepository';

function useBackendRead<T>(read: () => Promise<T>) {
  const [result, setResult] = useState<{ data?: T; error?: string }>({});
  const [request, setRequest] = useState(0);

  useEffect(() => {
    let active = true;
    setResult({});
    void read().then(
      (data) => {
        if (active) setResult({ data });
      },
      (error: unknown) => {
        if (active) setResult({ error: describeBackendError(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [read, request]);

  return { ...result, retry: () => setRequest((previous) => previous + 1) };
}

export function ConnectedFamily({
  client,
  userId,
}: {
  client: BackendClient;
  userId: string;
}) {
  const repository = useMemo(
    () => createSupabaseFamilyRepository(client),
    [client],
  );
  const trees = useBackendRead(repository.listTrees);
  const [selected, setSelected] = useState<string>();
  const [name, setName] = useState('');
  const signout = useSave();
  const active =
    trees.data?.find((tree) => tree.id === selected) ?? trees.data?.[0];

  return (
    <>
      <Type variant="heading" accessibilityRole="header">
        Connected family trees
      </Type>
      {trees.error ? (
        <ErrorState message={trees.error} onRetry={trees.retry} />
      ) : !trees.data ? (
        <LoadingState label="Loading your trees…" />
      ) : trees.data.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {trees.data.map((tree) => (
            <Button
              key={tree.id}
              label={tree.name}
              variant="secondary"
              selected={tree.id === active?.id}
              accessibilityState={{ selected: tree.id === active?.id }}
              onPress={() => setSelected(tree.id)}
            />
          ))}
        </View>
      ) : (
        <Type tone="muted">
          You don’t belong to a connected family tree yet. Create one to get
          started.
        </Type>
      )}
      {active && (
        <TreePeople
          key={active.id}
          tree={active}
          repository={repository}
          userId={userId}
        />
      )}
      <RecordForm
        label="New tree name"
        button="Create connected tree"
        value={name}
        setValue={setName}
        maxLength={120}
        onSave={async (value) => {
          const created = await repository.createTree(value);
          setSelected(created.id);
          trees.retry();
        }}
      />
      {signout.error && (
        <Type tone="danger" accessibilityRole="alert">
          Couldn’t sign out. Try again.
        </Type>
      )}
      <Button
        label={signout.saving ? 'Signing out…' : 'Sign out'}
        variant="quiet"
        disabled={signout.saving}
        onPress={() =>
          void signout.save(
            async () => {
              const { error } = await client.auth.signOut({ scope: 'local' });
              if (error) throw error;
            },
            () => undefined,
          )
        }
      />
    </>
  );
}

function TreePeople({
  tree,
  repository,
  userId,
}: {
  tree: ConnectedTree;
  repository: ConnectedFamilyRepository;
  userId: string;
}) {
  const readTree = useCallback(
    () => repository.readTree(tree.id, userId),
    [repository, tree.id, userId],
  );
  const { data, error, retry } = useBackendRead(readTree);
  const [name, setName] = useState('');
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data) return <LoadingState label="Loading family members…" />;
  return (
    <View style={{ gap: 10 }}>
      <Type variant="label">
        {tree.name} · {data.role}
      </Type>
      {data.people.length ? (
        data.people.map((person) => (
          <Type key={person.id}>{person.display_name}</Type>
        ))
      ) : (
        <Type tone="muted">This connected tree has no family members yet.</Type>
      )}
      {data.role !== 'viewer' && (
        <RecordForm
          label="Family member name"
          button="Add family member"
          value={name}
          setValue={setName}
          maxLength={160}
          onSave={async (value) => {
            await repository.addPerson({
              tree_id: tree.id,
              display_name: value,
            });
            retry();
          }}
        />
      )}
    </View>
  );
}

function RecordForm({
  label,
  button,
  value,
  setValue,
  maxLength,
  onSave,
}: {
  label: string;
  button: string;
  value: string;
  setValue: (value: string) => void;
  maxLength: number;
  onSave: (value: string) => Promise<void>;
}) {
  const { save, saving, error } = useSave();
  function submit() {
    const name = value.trim();
    if (name)
      void save(
        () => onSave(name),
        () => setValue(''),
      );
  }
  return (
    <View style={{ gap: 8 }}>
      <TextField
        label={label}
        value={value}
        onChangeText={setValue}
        maxLength={maxLength}
        onSubmitEditing={submit}
      />
      {error && (
        <Type tone="danger" accessibilityRole="alert">
          Couldn’t save this record. Check your access and try again.
        </Type>
      )}
      <Button
        label={saving ? 'Saving…' : button}
        disabled={saving || !value.trim()}
        onPress={submit}
      />
    </View>
  );
}
