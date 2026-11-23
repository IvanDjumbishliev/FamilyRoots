import { useCallback, useState } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { useSave } from '@/features/family/useSave';
import { usePeopleQuery } from '@/features/people/usePeople';
import type {
  CollaborationRepository,
  CommentColumn,
} from '@/services/collaborationRepository';

import { useCollaboration } from './useCollaboration';

export function CollaborationThread({
  treeId,
  target,
  id,
  canEdit,
  title = 'Discussion',
}: {
  treeId: string;
  target: CommentColumn;
  id: string;
  canEdit: boolean;
  title?: string;
}) {
  const { repository, userId } = useCollaboration();
  return repository ? (
    <Thread
      repository={repository}
      userId={userId}
      treeId={treeId}
      target={target}
      id={id}
      canEdit={canEdit}
      title={title}
    />
  ) : null;
}

function Thread({
  repository,
  userId,
  treeId,
  target,
  id,
  canEdit,
  title,
}: {
  repository: CollaborationRepository;
  userId?: string;
  treeId: string;
  target: CommentColumn;
  id: string;
  canEdit: boolean;
  title: string;
}) {
  const read = useCallback(async () => {
    const [comments, summary] = await Promise.all([
      repository.comments(treeId, target, id),
      repository.summary(treeId),
    ]);
    return {
      comments,
      names: new Map(summary.members.map((member) => [member.id, member.name])),
    };
  }, [repository, treeId, target, id]);
  const query = usePeopleQuery(read);
  const [body, setBody] = useState('');
  const request = useSave();

  return (
    <Card>
      <Type variant="heading" accessibilityRole="header">
        {title}
      </Type>
      {query.error ? (
        <ErrorState message={query.error} onRetry={query.reload} />
      ) : !query.data ? (
        <LoadingState label="Loading comments…" />
      ) : query.data.comments.length ? (
        query.data.comments.map((comment) => (
          <Card key={comment.id}>
            <Type variant="label">
              {comment.author_id === userId
                ? 'You'
                : (query.data?.names.get(comment.author_id ?? '') ??
                  'A tree member')}
            </Type>
            <Type>{comment.body}</Type>
            <Type variant="detail" tone="muted">
              {new Date(comment.created_at).toLocaleString()}
            </Type>
          </Card>
        ))
      ) : (
        <Type tone="muted">No comments yet.</Type>
      )}
      {canEdit && (
        <>
          <TextField
            label="Comment"
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={2000}
          />
          {request.error && (
            <Type tone="danger" accessibilityRole="alert">
              Couldn’t post the comment.
            </Type>
          )}
          <Button
            label={request.saving ? 'Posting…' : 'Post comment'}
            disabled={request.saving || !body.trim()}
            onPress={() =>
              void request.save(
                () => repository.comment(treeId, target, id, body.trim()),
                () => {
                  setBody('');
                  query.reload();
                },
              )
            }
          />
        </>
      )}
    </Card>
  );
}
