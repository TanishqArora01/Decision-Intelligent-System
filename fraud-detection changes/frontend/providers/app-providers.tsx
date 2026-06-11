'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth-provider';
import { SimulationProvider } from '@/providers/simulation-provider';
import { WorkspaceProvider } from '@/providers/workspace-provider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider>
        <AuthProvider>
          <SimulationProvider>
            {children}
            <Toaster position="top-right" theme="dark" richColors closeButton />
          </SimulationProvider>
        </AuthProvider>
      </WorkspaceProvider>
    </QueryClientProvider>
  );
}
