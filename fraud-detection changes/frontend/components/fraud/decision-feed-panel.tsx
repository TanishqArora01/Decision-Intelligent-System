'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { OutcomeBadge } from '@/components/fraud/decision-badge';
import { useSimulationStore } from '@/lib/stores/simulation-store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { feedItemVariants } from '@/lib/animations';
import { useState } from 'react';
import { formatCurrency } from '@/lib/format';

const FILTERS = ['ALL', 'APPROVE', 'BLOCK', 'STEP_UP_AUTH', 'MANUAL_REVIEW'] as const;

export function DecisionFeedPanel() {
  const [filter, setFilter] = useState<string>('ALL');
  const streamingLive = useWorkspaceStore((s) => s.streamingLive);
  const recent = useSimulationStore((s) => s.recentDecisions);
  const rows = filter === 'ALL' ? recent : recent.filter((d) => d.outcome === filter);

  return (
    <div className="surface-card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-bg-border px-4 py-3">
        <p className="text-subheading">Decision feed</p>
        <SegmentedControl options={FILTERS.map((f) => ({ value: f, label: f.replace(/_/g, ' ') }))} value={filter} onChange={setFilter} />
      </div>
      <div className="scrollbar-thin max-h-96 overflow-y-auto p-2">
        {!streamingLive ? (
          <p className="p-8 text-center text-small text-text-muted">Stream paused — enable in Settings</p>
        ) : (
          <AnimatePresence mode="popLayout">
            {rows.slice(0, 50).map((d) => (
              <motion.div
                key={d.id}
                layout
                variants={feedItemVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="grid grid-cols-[1fr_auto] gap-2 border-b border-bg-border px-3 py-2.5 text-small last:border-0 hover:bg-bg-elevated"
              >
                <div>
                  <p className="font-mono text-micro">{d.txnId}</p>
                  <p className="text-micro text-text-muted">
                    {formatCurrency(d.amount)} · {(d.pFraud * 100).toFixed(1)}% · {d.totalLatencyMs.toFixed(1)}ms
                  </p>
                </div>
                <OutcomeBadge outcome={d.outcome} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
