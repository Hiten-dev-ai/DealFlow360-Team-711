import { createContext, useContext, type ReactNode } from 'react';
import type { WorkspaceData } from './api';

export type ConnectionState = 'online' | 'syncing' | 'offline' | 'degraded';

export interface WorkspaceContextValue {
  data: WorkspaceData;
  connection: ConnectionState;
  syncedAt: string | null;
  refresh: () => Promise<void>;
  run: <T>(operation: () => Promise<T>) => Promise<T>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ value, children }: { value: WorkspaceContextValue; children: ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('WorkspaceProvider is missing.');
  return value;
}
