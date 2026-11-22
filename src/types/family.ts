export type Workspace = 'sample' | 'empty';

export type NewPerson = {
  name: string;
  generation: number;
  birthYear?: number;
  relation?: string;
};
export type Person = NewPerson & { id: string; createdAt: string };
export type NewMemory = { name: string; uri: string; mimeType: string };
export type Memory = NewMemory & { id: string; createdAt: string };
export type Book = {
  id: string;
  title: string;
  chapters: readonly string[];
  createdAt: string;
};
export type Activity = { id: string; label: string; createdAt: string };
export type HistoryEvent = { id: string; year: number; label: string };

export type FamilySnapshot = {
  profileName: string;
  familyName: string;
  people: readonly Person[];
  memories: readonly Memory[];
  books: readonly Book[];
  activity: readonly Activity[];
  history: readonly HistoryEvent[];
};

export interface FamilyRepository {
  getSnapshot(workspace: Workspace): FamilySnapshot;
  subscribe(listener: () => void): () => void;
  addPerson(workspace: Workspace, person: NewPerson): Promise<void>;
  addMemory(workspace: Workspace, memory: NewMemory): Promise<void>;
  createBook(workspace: Workspace, title: string): Promise<void>;
}
