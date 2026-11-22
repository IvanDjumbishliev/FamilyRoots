import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';

import { createMockFamilyRepository } from '@/services/mockFamilyRepository';
import type { FamilyRepository, Workspace } from '@/types/family';

const FamilyContext = createContext<{
  repository: FamilyRepository;
  workspace: Workspace;
  setWorkspace: (workspace: Workspace) => void;
} | null>(null);

export function FamilyProvider({
  children,
  repository: injected,
}: PropsWithChildren<{ repository?: FamilyRepository }>) {
  const [repository] = useState(() => injected ?? createMockFamilyRepository());
  const [workspace, setWorkspace] = useState<Workspace>('sample');

  return (
    <FamilyContext.Provider value={{ repository, workspace, setWorkspace }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (!context) throw new Error('FamilyProvider is required.');
  const { repository, workspace } = context;
  const getSnapshot = () => repository.getSnapshot(workspace);
  const snapshot = useSyncExternalStore(
    repository.subscribe,
    getSnapshot,
    getSnapshot,
  );
  return { ...context, snapshot };
}
