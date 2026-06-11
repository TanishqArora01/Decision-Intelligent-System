'use client';

import { cn, fmtPct } from '@/lib/utils';
import type { Action, CaseStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

const ACTION_VARIANT: Record<Action, 'green' | 'danger' | 'warning' | 'purple'> = {
  APPROVE: 'green',
  BLOCK: 'danger',
  STEP_UP_AUTH: 'warning',
  MANUAL_REVIEW: 'purple',
};

export function DecisionBadge({ action, size = 'sm' }: { action: Action; size?: 'xs' | 'sm' }) {
  return (
    <Badge variant={ACTION_VARIANT[action] ?? 'default'} className={size === 'xs' ? 'text-[9px]' : ''}>
      {action.replace(/_/g, ' ')}
    </Badge>
  );
}

export function FraudScoreBar({ score, className }: { score: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, score * 100));
  const color = pct >= 70 ? 'bg-accent-danger' : pct >= 40 ? 'bg-accent-warning' : 'bg-accent-green';
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-text-secondary">{fmtPct(score)}</span>
    </div>
  );
}

export function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color = 'cyan',
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
}) {
  return (
    <div className="glass-panel p-5">
      <div className="flex items-start justify-between">
        <p className="metric-label">{title}</p>
        {Icon && <Icon className="h-4 w-4 text-accent-cyan" />}
      </div>
      <p className="metric-value mt-2">{value}</p>
      {sub && <p className="mt-1 text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-8 w-8 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent',
        className,
      )}
    />
  );
}

export function PriorityBadge({ priority }: { priority: number }) {
  const v = priority >= 3 ? 'danger' : priority >= 2 ? 'warning' : 'cyan';
  return <Badge variant={v}>P{priority}</Badge>;
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  const map: Record<CaseStatus, 'cyan' | 'warning' | 'green' | 'danger'> = {
    OPEN: 'cyan',
    IN_REVIEW: 'warning',
    RESOLVED: 'green',
    ESCALATED: 'danger',
  };
  return <Badge variant={map[status]}>{status.replace(/_/g, ' ')}</Badge>;
}

export function EmptyState({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon className="mb-3 h-10 w-10 text-text-muted opacity-40" />}
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-text-muted">{description}</p>}
    </div>
  );
}
