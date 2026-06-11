'use client';

import { useMemo, useState } from 'react';
import { useSimulationStore } from '@/lib/stores/simulation-store';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { OutcomeBadge } from '@/components/fraud/decision-badge';
import { ShimmerRadar } from '@/components/ui/shimmer-radar';
import { formatCurrency } from '@/lib/format';
import { useWorkspaceStore } from '@/store/workspace.store';
import type { DecisionOutcome } from '@/lib/pipeline/types';

const FILTERS = ['ALL', 'APPROVE', 'BLOCK', 'STEP_UP_AUTH', 'MANUAL_REVIEW'] as const;

export function TransactionGrid({ title }: { title: string }) {
  const [filter, setFilter] = useState<string>('ALL');
  const streamingLive = useWorkspaceStore((s) => s.streamingLive);
  const recentDecisions = useSimulationStore((s) => s.recentDecisions);

  const rows = useMemo(() => {
    if (filter === 'ALL') return recentDecisions;
    return recentDecisions.filter((d) => d.outcome === filter);
  }, [recentDecisions, filter]);

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">Workspace 03</p>
          <h1 className="font-display text-3xl font-semibold">{title}</h1>
        </div>
        <SegmentedControl
          options={FILTERS.map((f) => ({ value: f, label: f.replace(/_/g, ' ') }))}
          value={filter}
          onChange={setFilter}
        />
      </header>

      {!streamingLive ? (
        <div className="glass-panel">
          <ShimmerRadar label="Listening for incoming transaction packets…" />
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-bg-secondary/80 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">P(fraud)</th>
                  <th className="px-4 py-3">AML</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-4 py-3">Outcome</th>
                  <th className="px-4 py-3">Pipeline</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-text-muted">
                      Ingesting packets…
                    </td>
                  </tr>
                ) : (
                  rows.slice(0, 100).map((d) => (
                    <tr key={d.id} className="border-b border-slate-800/60 hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 font-mono text-xs">{d.txnId}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{d.accountId}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{formatCurrency(d.amount, d.currency)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-amber-400">{(d.pFraud * 100).toFixed(2)}%</td>
                      <td className="px-4 py-2.5 font-mono text-[10px]">{d.amlCategory}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{d.totalLatencyMs.toFixed(1)}ms</td>
                      <td className="px-4 py-2.5">
                        <OutcomeBadge outcome={d.outcome} />
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-2.5 font-mono text-[9px] text-text-muted">
                        {d.pipelinePath}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
