'use client';

import { useSpring, animated } from '@react-spring/web';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MetricCard({
  label,
  value,
  numericValue,
  prefix = '',
  suffix = '',
  sparkline,
  status = 'green',
  icon: Icon,
}: {
  label: string;
  value?: string;
  numericValue?: number;
  prefix?: string;
  suffix?: string;
  sparkline?: { v: number }[];
  status?: 'green' | 'yellow' | 'red';
  icon: LucideIcon;
}) {
  const { number } = useSpring({
    from: { number: 0 },
    to: { number: numericValue ?? 0 },
    delay: 200,
    config: { mass: 1, tension: 80, friction: 20 },
  });

  const statusColor = {
    green: 'bg-semantic-approve',
    yellow: 'bg-semantic-stepup',
    red: 'bg-semantic-block',
  }[status];

  return (
    <div className="surface-card p-5 transition hover:-translate-y-0.5 hover:shadow-glow">
      <div className="flex items-start justify-between">
        <p className="metric-label">{label}</p>
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', statusColor)} />
          <Icon className="h-4 w-4 text-text-muted" />
        </div>
      </div>
      {numericValue !== undefined ? (
        <animated.p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-text-primary">
          {number.to((n) => `${prefix}${Math.floor(n).toLocaleString()}${suffix}`)}
        </animated.p>
      ) : (
        <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{value}</p>
      )}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-3 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkline}>
              <Line type="monotone" dataKey="v" stroke="var(--chart-1)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
