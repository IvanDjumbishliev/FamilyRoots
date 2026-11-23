import { useRef, useState } from 'react';

const attempts = new Map<string, number>();

export function useAuthRequest() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(
    bucket: string,
    seconds: number,
    work: () => Promise<void>,
    fallback: string,
  ) {
    if (lock.current) return;
    const now = Date.now();
    const available = attempts.get(bucket) ?? 0;
    if (available > now) {
      setMessage(
        `Wait ${Math.ceil((available - now) / 1000)} seconds and try again.`,
      );
      return;
    }
    attempts.set(bucket, now + seconds * 1000);
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch {
      setMessage(fallback);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return { submit, busy, message };
}
