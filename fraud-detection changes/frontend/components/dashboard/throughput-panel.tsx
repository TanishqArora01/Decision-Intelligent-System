'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useSimulationStore } from '@/lib/stores/simulation-store';

export function ThroughputPanel() {
  const history = useSimulationStore((s) => s.metrics.throughputHistory);
  const lag = useSimulationStore((s) => s.metrics.consumerLag);

  return (
    <div className="surface-card space-y-4 p-5">
      <p className="text-subheading">Metrics panel</p>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history}>
            <defs>
              <linearGradient id="tp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }} />
            <Area type="monotone" dataKey="eps" stroke="var(--chart-1)" fill="url(#tp)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between text-small">
        <span className="text-text-muted">Consumer lag</span>
        <span className="font-mono text-semantic-stepup">{lag} ms</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="h-2 w-2 rounded-full bg-semantic-approve" />
        ))}
        <span className="ml-2 text-micro text-text-muted">12 active workers</span>
      </div>
    </div>
  );
}
