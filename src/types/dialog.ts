import type { ReactNode } from 'react';

export type DialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
};
