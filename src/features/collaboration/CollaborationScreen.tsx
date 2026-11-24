import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { emailSchema } from '@/features/auth/validation';
import { useSave } from '@/features/family/useSave';
import { Choices } from '@/features/people/Choices';
import { usePeopleQuery } from '@/features/people/usePeople';
import {
  collaborationError,
  type CollaborationRepository,
  type Review,
} from '@/services/collaborationRepository';

const roles = [
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
] as const;
const entityNames: Record<string, string> = {
  people: 'Person',
  family_trees: 'Family tree',
  tree_memberships: 'Membership',
  life_events: 'Timeline event',
  parent_child_relationships: 'Parent-child relationship',
  partnerships: 'Partnership',
  other_family_relationships: 'Family relationship',
  archive_items: 'Archive item',
  collaboration_comments: 'Comment',
  tree_reviews: 'Review',
  sources: 'Source',
  research_findings: 'Research finding',
  research_matches: 'Research decision',
};
type Summary = Awaited<ReturnType<CollaborationRepository['summary']>>;

export function CollaborationScreen({
  repository,
  initialTree,
}: {
  repository: CollaborationRepository;
  initialTree: string;
}) {
  const [tree, setTree] = useState(initialTree);
  const trees = usePeopleQuery(repository.trees);
  const selected = trees.data?.find((candidate) => candidate.id === tree);
  return (
    <Screen>
      <PageHeading title="Family collaboration" description={selected?.name} />
      <ActionLink
        href="/invitations"
        label="My tree invitations"
        variant="secondary"
      />
      {(trees.data?.length ?? 0) > 1 && (
        <Choices
          label="Family tree"
          choices={
            trees.data?.map(({ id, name }) => ({ value: id, label: name })) ??
            []
          }
          value={tree}
          onChange={setTree}
        />
      )}
      {trees.error && (
        <ErrorState message={trees.error} onRetry={trees.reload} />
      )}
      <Workspace key={tree} repository={repository} tree={tree} />
    </Screen>
  );
}

function Workspace({
  repository,
  tree,
}: {
  repository: CollaborationRepository;
  tree: string;
}) {
  const read = useCallback(
    async () => ({
      summary: await repository.summary(tree),
      reviews: await repository.reviews(tree),
    }),
    [repository, tree],
  );
  const query = usePeopleQuery(read);
  if (query.error)
    return <ErrorState message={query.error} onRetry={query.reload} />;
  if (!query.data) return <LoadingState label="Loading collaboration…" />;
  return (
    <WorkspaceContent
      repository={repository}
      tree={tree}
      {...query.data}
      refresh={query.reload}
    />
  );
}

function WorkspaceContent({
  repository,
  tree,
  summary,
  reviews,
  refresh,
}: {
  repository: CollaborationRepository;
  tree: string;
  summary: Summary;
  reviews: Review[];
  refresh: () => void;
}) {
  const owner = summary.role === 'owner';
  const [member, setMember] = useState<Summary['members'][number]>();
  const [cancel, setCancel] = useState<Summary['invitations'][number]>();
  const [review, setReview] = useState<Review>();
  const [actionMessage, setActionMessage] = useState('');
  const request = useSave();
  const unread = summary.changes.filter((change) => change.unread).length;
  const names = new Map(
    summary.members.map((person) => [person.id, person.name]),
  );
  function action(write: () => Promise<void>, success: () => void) {
    setActionMessage('');
    void request.save(
      async () => {
        try {
          await write();
        } catch (error) {
          setActionMessage(await collaborationError(error));
          throw error;
        }
      },
      () => {
        success();
        refresh();
      },
    );
  }
  return (
    <>
      {owner && (
        <InvitationForm repository={repository} tree={tree} refresh={refresh} />
      )}
      {owner && summary.invitations.length > 0 && (
        <Card>
          <Type variant="heading" accessibilityRole="header">
            Sent invitations
          </Type>
          {summary.invitations.map((invite) => (
            <View key={invite.id} style={{ gap: 4 }}>
              <Type variant="label">{invite.email}</Type>
              <Type tone="muted">
                {invite.role} · {invite.status}
                {invite.status === 'pending' && !invite.sentAt
                  ? ' · Email delivery not confirmed'
                  : ''}
              </Type>
              {invite.status === 'pending' && (
                <Button
                  label="Cancel invitation"
                  variant="quiet"
                  onPress={() => {
                    setActionMessage('');
                    setCancel(invite);
                  }}
                />
              )}
            </View>
          ))}
        </Card>
      )}
      <Card>
        <Type variant="heading" accessibilityRole="header">
          Tree members
        </Type>
        {summary.members.map((item) => (
          <View key={item.id} style={{ gap: 4 }}>
            <Type variant="label">{item.name ?? 'Family member'}</Type>
            <Type tone="muted">{item.role}</Type>
            {owner && item.role !== 'owner' && (
              <Button
                label={`Manage ${item.name ?? 'member'}`}
                variant="secondary"
                onPress={() => {
                  setActionMessage('');
                  setMember(item);
                }}
              />
            )}
          </View>
        ))}
      </Card>
      <Card>
        <Type variant="heading" accessibilityRole="header">
          Review queue
        </Type>
        {!reviews.length && (
          <Type tone="muted">
            No corrections or disputed relationships yet.
          </Type>
        )}
        {reviews.map((item) => (
          <View key={item.id} style={{ gap: 4 }}>
            <Type variant="label">
              {item.field === 'verification_status'
                ? 'Disputed relationship'
                : `Correction · ${item.field.replaceAll('_', ' ')}`}
            </Type>
            <Type>{item.reason}</Type>
            <Type tone="muted">
              {item.status.replaceAll('_', ' ')} ·{' '}
              {names.get(item.proposed_by ?? '') ?? 'A tree member'}
            </Type>
            <Button
              label="Open review"
              variant="secondary"
              onPress={() => setReview(item)}
            />
          </View>
        ))}
      </Card>
      <Card>
        <Type variant="heading" accessibilityRole="header">
          Recent changes
        </Type>
        <Type accessibilityLiveRegion="polite">
          {unread
            ? `${unread} unread ${unread === 1 ? 'update' : 'updates'} in recent activity`
            : 'You’re caught up on recent activity.'}
        </Type>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button label="Refresh updates" variant="quiet" onPress={refresh} />
          {unread > 0 && (
            <Button
              label="Mark updates read"
              variant="secondary"
              disabled={request.saving}
              onPress={() =>
                action(
                  () => repository.markRead(tree, summary.changes[0].at),
                  () => undefined,
                )
              }
            />
          )}
        </View>
        {summary.changes.map((change) => (
          <View key={change.id} style={{ gap: 4 }}>
            <Type variant="label">
              {entityNames[change.entity] ?? 'Tree record'}{' '}
              {change.operation === 'insert'
                ? 'added'
                : change.operation === 'delete'
                  ? 'removed'
                  : 'updated'}
              {change.unread ? ' · New' : ''}
            </Type>
            <Type tone="muted">
              {change.actorId
                ? (names.get(change.actorId) ?? 'A former or unnamed member')
                : 'System'}{' '}
              · {new Date(change.at).toLocaleString()}
            </Type>
            {!!change.fields.length && (
              <Type variant="detail" tone="muted">
                {change.fields
                  .map((field) => field.replaceAll('_', ' '))
                  .join(', ')}
              </Type>
            )}
          </View>
        ))}
      </Card>
      {actionMessage && !member && !cancel && (
        <Type tone="danger" accessibilityRole="alert">
          {actionMessage}
        </Type>
      )}
      <Dialog
        open={Boolean(member)}
        title={`Manage ${member?.name ?? 'member'}`}
        onClose={() => setMember(undefined)}
      >
        {member && (
          <>
            <Type>Current role · {member.role}</Type>
            <Button
              label={member.role === 'editor' ? 'Make viewer' : 'Make editor'}
              disabled={request.saving}
              onPress={() =>
                action(
                  () =>
                    repository.changeMember(
                      tree,
                      member.id,
                      member.role === 'editor' ? 'viewer' : 'editor',
                    ),
                  () => setMember(undefined),
                )
              }
            />
            <Type tone="muted">
              Revoking access removes this person from the tree immediately.
            </Type>
            <Button
              label="Confirm revoke access"
              variant="secondary"
              disabled={request.saving}
              onPress={() =>
                action(
                  () => repository.changeMember(tree, member.id, null),
                  () => setMember(undefined),
                )
              }
            />
          </>
        )}
        {actionMessage && (
          <Type tone="danger" accessibilityRole="alert">
            {actionMessage}
          </Type>
        )}
      </Dialog>
      <Dialog
        open={Boolean(cancel)}
        title="Cancel this invitation?"
        onClose={() => setCancel(undefined)}
      >
        <Type>{cancel?.email}</Type>
        <Button
          label="Confirm cancellation"
          disabled={request.saving}
          onPress={() => {
            if (cancel)
              action(
                () => repository.cancel(tree, cancel.id),
                () => setCancel(undefined),
              );
          }}
        />
        {actionMessage && (
          <Type tone="danger" accessibilityRole="alert">
            {actionMessage}
          </Type>
        )}
      </Dialog>
      <Dialog
        open={Boolean(review)}
        title="Review details"
        onClose={() => setReview(undefined)}
      >
        {review && (
          <ReviewDetail
            key={review.id}
            repository={repository}
            review={review}
            owner={owner}
            onResolved={() => {
              setReview(undefined);
              refresh();
            }}
          />
        )}
      </Dialog>
    </>
  );
}

function InvitationForm({
  repository,
  tree,
  refresh,
}: {
  repository: CollaborationRepository;
  tree: string;
  refresh: () => void;
}) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const request = useSave();
  return (
    <Card>
      <Type variant="heading" accessibilityRole="header">
        Invite a relative
      </Type>
      <TextField
        label="Relative’s email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setConsent(false);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        maxLength={254}
      />
      <Choices
        label="Invitation role"
        choices={roles}
        value={role}
        onChange={setRole}
      />
      <Button
        label="I have consent to share living relatives’ information in this tree with this person"
        variant="secondary"
        selected={consent}
        aria-checked={consent}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        onPress={() => setConsent(!consent)}
      />
      {message && (
        <Type
          tone={sent ? 'success' : 'danger'}
          accessibilityLiveRegion="polite"
        >
          {message}
        </Type>
      )}
      <Button
        label={request.saving ? 'Sending…' : 'Send invitation'}
        disabled={request.saving || !consent}
        onPress={() => {
          const parsed = emailSchema.safeParse(email.trim());
          setSent(false);
          if (!parsed.success) {
            setMessage('Enter a valid email address.');
            return;
          }
          void request.save(async () => {
            try {
              const result = await repository.invite(
                tree,
                parsed.data,
                role,
                consent,
              );
              setSent(true);
              setEmail('');
              setConsent(false);
              setMessage(
                result.delivered
                  ? 'Invitation emailed.'
                  : 'Invitation saved. Email delivery was not confirmed.',
              );
            } catch (error) {
              setMessage(await collaborationError(error));
              throw error;
            }
          }, refresh);
        }}
      />
    </Card>
  );
}

function ReviewDetail({
  repository,
  review,
  owner,
  onResolved,
}: {
  repository: CollaborationRepository;
  review: Review;
  owner: boolean;
  onResolved: () => void;
}) {
  const read = useCallback(
    () => repository.inspect(review.id),
    [repository, review.id],
  );
  const query = usePeopleQuery(read);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const request = useSave();
  if (query.error)
    return <ErrorState message={query.error} onRetry={query.reload} />;
  if (!query.data) return <LoadingState label="Loading current record…" />;
  const current = query.data;
  const dispute = review.field === 'verification_status';
  function decide(decision: string) {
    void request.save(async () => {
      setMessage('');
      try {
        await repository.resolve(
          review.id,
          decision,
          current.version,
          note.trim(),
        );
      } catch (error) {
        setMessage(await collaborationError(error));
        throw error;
      }
    }, onResolved);
  }
  return (
    <>
      <Type variant="heading">{current.label}</Type>
      <Type>{review.reason}</Type>
      <Type variant="label">At submission</Type>
      <Type>{review.base_value ?? 'Blank'}</Type>
      <Type variant="label">Proposed value</Type>
      <Type>{review.proposed_value ?? 'Clear this field'}</Type>
      <Type variant="label">Current record</Type>
      <Type>
        {current.available ? (current.value ?? 'Blank') : 'Record removed'}
      </Type>
      {review.resolution_note && <Type>{review.resolution_note}</Type>}
      {review.resolved_at && (
        <Type tone="muted">
          Resolved {new Date(review.resolved_at).toLocaleString()}
        </Type>
      )}
      {owner && review.status === 'pending' && (
        <>
          <TextField
            label="Resolution note (optional)"
            value={note}
            onChangeText={setNote}
            maxLength={2000}
            multiline
          />
          {current.available &&
            (dispute ? (
              <>
                {!current.aiSuggested && (
                  <Button
                    label="Verify relationship"
                    disabled={request.saving}
                    onPress={() => decide('verified')}
                  />
                )}
                <Button
                  label="Mark unverified"
                  variant="secondary"
                  disabled={request.saving}
                  onPress={() => decide('unverified')}
                />
              </>
            ) : (
              <Button
                label="Apply proposed value"
                disabled={request.saving}
                onPress={() => decide('apply')}
              />
            ))}
          <Button
            label={dispute ? 'Keep disputed' : 'Keep current value'}
            variant="secondary"
            disabled={request.saving}
            onPress={() => decide('keep')}
          />
          {message && (
            <Type tone="danger" accessibilityRole="alert">
              {message}
            </Type>
          )}
          <Button
            label="Reload current record"
            variant="quiet"
            onPress={query.reload}
          />
        </>
      )}
    </>
  );
}
