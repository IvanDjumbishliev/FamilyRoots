import { useState } from 'react';

import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { useSave } from '@/features/family/useSave';
import { Choices } from '@/features/people/Choices';
import {
  collaborationError,
  type ReviewTarget,
} from '@/services/collaborationRepository';

import { useCollaboration } from './useCollaboration';

const personFields = [
  { value: 'biography', label: 'Biography' },
  { value: 'notes', label: 'Notes' },
  { value: 'occupation', label: 'Occupation' },
  { value: 'nationality', label: 'Nationality' },
  { value: 'birth_place', label: 'Birth place' },
  { value: 'death_place', label: 'Death place' },
] as const;
const eventFields = [
  { value: 'title', label: 'Title' },
  { value: 'notes', label: 'Notes' },
  { value: 'place', label: 'Location' },
] as const;

export function ReviewProposal({
  treeId,
  target,
  id,
  draft,
  onSubmitted,
}: {
  treeId: string;
  target: ReviewTarget;
  id: string;
  draft?: Record<string, string>;
  onSubmitted?: () => void;
}) {
  const { repository } = useCollaboration();
  const dispute = target !== 'people' && target !== 'life_events';
  const fields = target === 'people' ? personFields : eventFields;
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<string>(fields[0].value);
  const [proposed, setProposed] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const request = useSave();
  const title = dispute ? 'Dispute relationship' : 'Propose correction';
  if (!repository) return null;
  const service = repository;

  return (
    <>
      <Button
        label={title}
        variant="quiet"
        onPress={() => {
          setProposed(draft?.[field] ?? '');
          setOpen(true);
          setSent(false);
          setMessage('');
        }}
      />
      {sent && (
        <Type tone="success" accessibilityLiveRegion="polite">
          Sent for owner review.
        </Type>
      )}
      <Dialog open={open} title={title} onClose={() => setOpen(false)}>
        {!dispute && (
          <>
            <Choices
              label="Record field"
              choices={fields}
              value={field}
              onChange={(value) => {
                setField(value);
                setProposed(draft?.[value] ?? '');
              }}
            />
            <TextField
              label="Proposed value"
              value={proposed}
              onChangeText={setProposed}
              maxLength={10000}
              multiline
            />
          </>
        )}
        <TextField
          label="Reason or supporting evidence"
          value={reason}
          onChangeText={setReason}
          maxLength={2000}
          multiline
        />
        {message && (
          <Type tone="danger" accessibilityRole="alert">
            {message}
          </Type>
        )}
        <Button
          label={request.saving ? 'Submitting…' : 'Submit for review'}
          disabled={request.saving || !reason.trim()}
          onPress={() =>
            void request.save(
              async () => {
                setMessage('');
                try {
                  await service.propose(
                    treeId,
                    target,
                    id,
                    dispute ? 'verification_status' : field,
                    proposed,
                    reason.trim(),
                  );
                } catch (error) {
                  setMessage(await collaborationError(error));
                  throw error;
                }
              },
              () => {
                setReason('');
                setOpen(false);
                setSent(true);
                onSubmitted?.();
              },
            )
          }
        />
      </Dialog>
    </>
  );
}
