'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  accent = 'cyan',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  accent?: 'cyan' | 'emerald' | 'amber' | 'crimson';
}) {
  const accentMap = {
    cyan: 'text-accent-cyan border-accent-cyan/20',
    emerald: 'text-emerald-400 border-emerald-500/20',
    amber: 'text-amber-400 border-amber-500/20',
    crimson: 'text-red-400 border-red-500/20',
  };

  return (
    <div className={cn('glass-panel border p-4', accentMap[accent])}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">{label}</p>
        <Icon className={cn('h-4 w-4 shrink-0 opacity-70', accentMap[accent].split(' ')[0])} />
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {sub && (
        <p
          className={cn(
            'mt-1 font-mono text-[10px]',
            trend === 'up' && 'text-emerald-400',
            trend === 'down' && 'text-red-400',
            !trend && 'text-text-muted',
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
