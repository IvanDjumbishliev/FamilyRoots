import { State } from '@/components/State';

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <State
      kind="error"
      title="Something went wrong"
      message={message}
      action={onRetry ? { label: 'Try again', onPress: onRetry } : undefined}
    />
  );
}
