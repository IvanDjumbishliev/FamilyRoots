import { useRef, useState } from 'react';

export function useSave() {
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function save(write: () => Promise<void>, onSuccess: () => void) {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError(false);
    try {
      await write();
      onSuccess();
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return { save, saving, error };
}
