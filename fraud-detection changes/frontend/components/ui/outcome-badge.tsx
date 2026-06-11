'use client';

import { cn } from '@/lib/utils';
import type { DecisionOutcome } from '@/lib/pipeline/types';

const STYLES: Record<DecisionOutcome, string> = {
  APPROVE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  BLOCK: 'bg-red-500/15 text-red-400 border-red-500/30',
  STEP_UP_AUTH: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  MANUAL_REVIEW: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
};

export function OutcomeBadge({ outcome, className }: { outcome: DecisionOutcome; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider',
        STYLES[outcome],
        className,
      )}
    >
      {outcome.replace(/_/g, ' ')}
    </span>
  );
}
