import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarCollapsed: boolean;
  assistantOpen: boolean;
  commandOpen: boolean;
  environment: 'production' | 'staging' | 'sandbox';
  streamingLive: boolean;
  toggleSidebar: () => void;
  setAssistantOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setEnvironment: (env: UIState['environment']) => void;
  setStreamingLive: (live: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      assistantOpen: false,
      commandOpen: false,
      environment: 'production',
      streamingLive: true,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setAssistantOpen: (open) => set({ assistantOpen: open }),
      setCommandOpen: (open) => set({ commandOpen: open }),
      setEnvironment: (environment) => set({ environment }),
      setStreamingLive: (streamingLive) => set({ streamingLive }),
    }),
    {
      name: 'fraud-iq-ui',
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        environment: s.environment,
        streamingLive: s.streamingLive,
      }),
    },
  ),
);
