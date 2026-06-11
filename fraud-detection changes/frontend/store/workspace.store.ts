import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WorkspaceEnv = 'production' | 'staging' | 'sandbox';
export type WorkspacePlan = 'starter' | 'growth' | 'scale' | 'enterprise';

interface WorkspaceState {
  bankId: string;
  bankName: string;
  bankSlug: string;
  plan: WorkspacePlan;
  env: WorkspaceEnv;
  theme: 'dark' | 'light';
  streamingLive: boolean;
  setEnv: (env: WorkspaceEnv) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setStreamingLive: (live: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      bankId: 'bank-demo',
      bankName: 'DecisionOS Demo Bank',
      bankSlug: 'demo',
      plan: 'scale',
      env: 'production',
      theme: 'dark',
      streamingLive: true,
      setEnv: (env) => set({ env }),
      setTheme: (theme) => set({ theme }),
      setStreamingLive: (streamingLive) => set({ streamingLive }),
    }),
    { name: 'decisionos-workspace' },
  ),
);
