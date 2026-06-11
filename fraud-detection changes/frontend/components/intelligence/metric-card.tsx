'use client';

import { motion } from 'framer-motion';
import { LucideIcon, TrendingDown, TrendingUp } from 'lucide-react';
import { cn, fmtNum } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: number;
  icon?: LucideIcon;
  accent?: 'cyan' | 'purple' | 'green' | 'danger' | 'warning';
  pulse?: boolean;
  className?: string;
}

const accentMap = {
  cyan: 'from-accent-cyan/20 to-transparent text-accent-cyan',
  purple: 'from-accent-purple/20 to-transparent text-accent-purple',
  green: 'from-accent-green/20 to-transparent text-accent-green',
  danger: 'from-accent-danger/20 to-transparent text-accent-danger',
  warning: 'from-accent-warning/20 to-transparent text-accent-warning',
};

export function MetricCard({
  label,
  value,
  sub,
  trend,
  icon: Icon,
  accent = 'cyan',
  pulse,
  className,
}: MetricCardProps) {
  const display = typeof value === 'number' ? fmtNum(value) : value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn('glass-panel relative overflow-hidden p-5', className)}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60', accentMap[accent])} />
      {pulse && (
        <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-accent-green animate-pulse" />
      )}
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <p className="metric-label">{label}</p>
          {Icon && (
            <div className={cn('rounded-lg border border-border-primary bg-surface-glass p-2', accentMap[accent].split(' ').pop())}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
        <p className="metric-value mt-2">{display}</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
          {sub && <span>{sub}</span>}
          {trend !== undefined && (
            <span className={cn('flex items-center gap-0.5', trend >= 0 ? 'text-accent-danger' : 'text-accent-green')}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
