'use client';

import { cn } from '@/lib/utils';
import type { DecisionOutcome } from '@/lib/pipeline/types';

const STYLES: Record<DecisionOutcome, string> = {
  APPROVE: 'bg-semantic-approve/15 text-semantic-approve border-semantic-approve/30',
  BLOCK: 'bg-semantic-block/15 text-semantic-block border-semantic-block/30 animate-[block-pulse_2s_ease-in-out_infinite]',
  STEP_UP_AUTH: 'bg-semantic-stepup/15 text-semantic-stepup border-semantic-stepup/30',
  MANUAL_REVIEW: 'bg-semantic-review/15 text-semantic-review border-semantic-review/30',
};

export function OutcomeBadge({ outcome, className }: { outcome: DecisionOutcome; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md border px-2 py-0.5 font-mono text-micro font-semibold uppercase tracking-wider',
        STYLES[outcome],
        className,
      )}
    >
      {outcome.replace(/_/g, ' ')}
    </span>
  );
}
