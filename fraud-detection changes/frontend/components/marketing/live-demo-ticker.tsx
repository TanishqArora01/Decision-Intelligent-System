'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OutcomeBadge } from '@/components/fraud/decision-badge';
import type { DecisionOutcome } from '@/lib/pipeline/types';

const MOCK = [
  { id: '1', txn: 'TXN-8F2A91', amount: '$4,280', country: '🇺🇸 US', outcome: 'APPROVE' as DecisionOutcome },
  { id: '2', txn: 'TXN-7C3B12', amount: '$12,440', country: '🇧🇷 BR', outcome: 'BLOCK' as DecisionOutcome },
  { id: '3', txn: 'TXN-9D1E55', amount: '€890', country: '🇩🇪 DE', outcome: 'STEP_UP_AUTH' as DecisionOutcome },
  { id: '4', txn: 'TXN-2A8F77', amount: '$1,102', country: '🇮🇳 IN', outcome: 'MANUAL_REVIEW' as DecisionOutcome },
];

export function LiveDemoTicker() {
  const [events, setEvents] = useState(MOCK.slice(0, 2));
  const [idx, setIdx] = useState(2);

  useEffect(() => {
    const t = setInterval(() => {
      const next = MOCK[idx % MOCK.length]!;
      setIdx((i) => i + 1);
      setEvents((prev) => [{ ...next, id: `${next.id}-${Date.now()}` }, ...prev].slice(0, 5));
    }, 1500);
    return () => clearInterval(t);
  }, [idx]);

  return (
    <div className="overflow-hidden border-y border-bg-border bg-bg-surface py-4">
      <div className="mx-auto flex max-w-content gap-3 overflow-x-auto px-6">
        <AnimatePresence mode="popLayout">
          {events.map((e) => (
            <motion.div
              key={e.id}
              layout
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="flex min-w-[240px] shrink-0 items-center justify-between gap-3 rounded-lg border border-bg-border bg-bg-elevated px-4 py-3"
            >
              <div>
                <p className="font-mono text-small">{e.txn}</p>
                <p className="text-micro text-text-muted">
                  {e.amount} · {e.country}
                </p>
              </div>
              <OutcomeBadge outcome={e.outcome} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
