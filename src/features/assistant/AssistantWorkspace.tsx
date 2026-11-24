import { useCallback, useRef, useState } from 'react';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { Choices } from '@/features/people/Choices';
import { usePeopleQuery } from '@/features/people/usePeople';
import { RelativePicker } from '@/features/relationships/RelativePicker';
import {
  assistantTasks,
  type AssistantRepository,
  type AssistantResult,
  type AssistantTask,
} from '@/services/assistantRepository';
import type { PeopleRepository } from '@/services/peopleRepository';

const labels = {
  verified: 'Verified in this tree',
  reported: 'Reported or quoted',
  unknown: 'Unknown or unsupported',
  suggestion: 'Research suggestion',
};
const modes = {
  mock: 'Grounded preview',
  live: 'AI-organized response',
  fallback: 'Grounded response · live organization unavailable',
};

export function AssistantWorkspace({
  repository,
  people,
  tree,
}: {
  repository: AssistantRepository;
  people: PeopleRepository;
  tree: string;
}) {
  const dirRead = useCallback(() => people.directory(tree), [people, tree]);
  const directory = usePeopleQuery(dirRead);
  const active =
    directory.data?.people.filter(
      (person) => !person.is_draft && !person.archived_at,
    ) ?? [];
  const [task, setTask] = useState<AssistantTask>('summary');
  const [first, setFirst] = useState<string>();
  const [second, setSecond] = useState<string>();
  const [document, setDocument] = useState('');
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState('');
  const [answer, setAnswer] = useState<AssistantResult>();
  const [cleared, setCleared] = useState(false);
  const revision = useRef(0);
  const needsFirst = ['relationship', 'biography', 'gaps', 'matches'].includes(
    task,
  );
  const usesFirst = needsFirst || task === 'summary';
  const missing =
    (needsFirst && !first) ||
    (task === 'relationship' && !second) ||
    (task === 'document' && !document.trim());

  function clear() {
    revision.current++;
    setFirst(undefined);
    setSecond(undefined);
    setDocument('');
    setAnswer(undefined);
    setIssue('');
    setBusy(false);
    setCleared(true);
  }

  async function run() {
    const current = ++revision.current;
    setIssue('');
    setCleared(false);
    setBusy(true);
    setAnswer(undefined);
    try {
      const subjects = usesFirst && first ? [first] : [];
      if (task === 'relationship' && second) subjects.push(second);
      const result = await repository.request(
        tree,
        task,
        subjects,
        task === 'document' ? document.trim() : undefined,
      );
      if (revision.current === current) setAnswer(result);
    } catch (error) {
      if (revision.current === current)
        setIssue(
          error instanceof Error
            ? error.message
            : 'Couldn’t run the assistant.',
        );
    } finally {
      if (revision.current === current) setBusy(false);
    }
  }
  return (
    <>
      <Card>
        <Type tone="muted">
          The assistant uses evidence from this tree and text you supply. Review
          its suggestions before editing any family records.
        </Type>
        <Choices
          label="Assistant task"
          choices={assistantTasks}
          value={task}
          onChange={(choice) => {
            if (choice !== task) {
              clear();
              setCleared(false);
              setTask(choice);
            }
          }}
        />
        {usesFirst &&
          (directory.error ? (
            <ErrorState message={directory.error} onRetry={directory.reload} />
          ) : !directory.data ? (
            <LoadingState label="Loading profiles…" />
          ) : (
            <>
              {task === 'summary' && (
                <Type tone="muted">
                  Leave the profile unselected for an overview of up to five
                  verified profiles.
                </Type>
              )}
              {active.length ? (
                <RelativePicker
                  people={active}
                  selected={first}
                  onSelect={(id) => {
                    setFirst(id);
                    if (second === id) setSecond(undefined);
                  }}
                  label={
                    task === 'relationship'
                      ? 'Find the first person'
                      : 'Find a profile'
                  }
                />
              ) : (
                <Type tone="muted">
                  Add an active profile to use person-specific tasks.
                </Type>
              )}
              {task === 'relationship' && (
                <RelativePicker
                  people={active.filter((person) => person.id !== first)}
                  selected={second}
                  onSelect={setSecond}
                  label="Find the second person"
                  optionLabel={(person) =>
                    `Choose ${person.display_name} as second person`
                  }
                />
              )}
            </>
          ))}
        {task === 'document' && (
          <TextField
            label="Document excerpt"
            value={document}
            onChangeText={setDocument}
            multiline
            maxLength={6000}
            hint="Paste up to 6,000 characters. Use text you have permission to share with this tree."
          />
        )}
        <Button
          label={busy ? 'Working…' : 'Run assistant'}
          disabled={busy || !!missing}
          onPress={() => void run()}
        />
        <Button
          label="Clear assistant session"
          variant="quiet"
          onPress={clear}
        />
        {cleared && (
          <Type tone="success" accessibilityLiveRegion="polite">
            Assistant session cleared.
          </Type>
        )}
      </Card>
      {busy && <LoadingState label="Preparing an evidence-based response…" />}
      {issue && <ErrorState message={issue} />}
      {answer && <Answer result={answer} tree={tree} />}
    </>
  );
}

function Answer({ result, tree }: { result: AssistantResult; tree: string }) {
  return (
    <Card>
      <Type variant="heading" accessibilityRole="header">
        Assistant response
      </Type>
      <Type tone="muted">{modes[result.mode]}</Type>
      {result.statements.map((statement) => (
        <Card key={statement.id}>
          <Type variant="label">{labels[statement.status]}</Type>
          <Type>{statement.text}</Type>
          {statement.citations.map((citation, index) => {
            const key = `${citation.kind}:${citation.id ?? index}:${index}`;
            if (
              (citation.kind === 'profile' ||
                citation.kind === 'relationship') &&
              citation.id
            )
              return (
                <ActionLink
                  key={key}
                  href={{
                    pathname: '/family-tree/[personId]',
                    params: { personId: citation.id },
                  }}
                  variant="quiet"
                  label={citation.label}
                />
              );
            if (citation.kind === 'event' && citation.id)
              return (
                <ActionLink
                  key={key}
                  href={{
                    pathname: '/timeline/[eventId]',
                    params: { eventId: citation.id },
                  }}
                  variant="quiet"
                  label={citation.label}
                />
              );
            if (citation.kind === 'discovery')
              return (
                <ActionLink
                  key={key}
                  href={{ pathname: '/discover', params: { treeId: tree } }}
                  variant="quiet"
                  label={citation.label}
                />
              );
            return (
              <Type key={key} variant="detail" tone="muted">
                {citation.label}
              </Type>
            );
          })}
        </Card>
      ))}
    </Card>
  );
}
