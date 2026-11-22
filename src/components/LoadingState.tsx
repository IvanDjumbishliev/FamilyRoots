import { State } from '@/components/State';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <State kind="loading" title={label} />;
}
