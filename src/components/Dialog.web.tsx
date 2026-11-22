import { useEffect, useId, useRef } from 'react';

import { DialogContent } from '@/components/DialogContent';
import { useTheme } from '@/hooks/useTheme';
import type { DialogProps } from '@/types/dialog';

export function Dialog({ open, title, children, onClose }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { theme } = useTheme();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      const trigger = document.activeElement;
      dialog.showModal();
      return () => {
        dialog.close();
        if (trigger instanceof HTMLElement) trigger.focus();
      };
    }
  }, [open]);

  return (
    <>
      <style>{`dialog[data-familyroots-dialog]::backdrop { background: ${theme.colors.overlay}; }`}</style>
      <dialog
        ref={ref}
        data-familyroots-dialog=""
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
        style={{
          width: 'min(460px, calc(100% - 32px))',
          maxHeight: 'calc(100% - 32px)',
          boxSizing: 'border-box',
          padding: 0,
          border: 0,
          borderRadius: theme.borders.card,
          background: theme.colors.surface,
          color: theme.colors.text,
        }}
      >
        {open && (
          <DialogContent title={title} titleId={titleId} onClose={onClose}>
            {children}
          </DialogContent>
        )}
      </dialog>
    </>
  );
}
