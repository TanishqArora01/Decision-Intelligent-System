'use client';

import { createContext, useContext, useEffect } from 'react';
import { useWorkspaceStore, type WorkspaceEnv, type WorkspacePlan } from '@/store/workspace.store';

interface WorkspaceContextValue {
  bankId: string;
  bankName: string;
  bankSlug: string;
  plan: WorkspacePlan;
  env: WorkspaceEnv;
  setEnv: (env: WorkspaceEnv) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const bankId = useWorkspaceStore((s) => s.bankId);
  const bankName = useWorkspaceStore((s) => s.bankName);
  const bankSlug = useWorkspaceStore((s) => s.bankSlug);
  const plan = useWorkspaceStore((s) => s.plan);
  const env = useWorkspaceStore((s) => s.env);
  const theme = useWorkspaceStore((s) => s.theme);
  const setEnv = useWorkspaceStore((s) => s.setEnv);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <WorkspaceContext.Provider value={{ bankId, bankName, bankSlug, plan, env, setEnv }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
