'use client';

import { useSimulationEngine } from '@/hooks/useSimulation';

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  useSimulationEngine();
  return <>{children}</>;
}
