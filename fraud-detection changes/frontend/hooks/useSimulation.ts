'use client';

import { useEffect, useRef } from 'react';
import { processTransaction } from '@/lib/pipeline/decision-engine';
import { persistDecision, persistStreamLog } from '@/lib/db';
import { useSimulationStore } from '@/lib/stores/simulation-store';
import { useWorkspaceStore } from '@/store/workspace.store';

/** Client-side high-throughput pipeline simulator (batched for browser stability). */
export function useSimulationEngine() {
  const streamingLive = useWorkspaceStore((s) => s.streamingLive);
  const ingestBatch = useSimulationStore((s) => s.ingestBatch);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!streamingLive) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    const tick = async () => {
      const batchSize = 8 + Math.floor(Math.random() * 12);
      const batch = Array.from({ length: batchSize }, () => processTransaction());

      ingestBatch(batch);

      await Promise.all(
        batch.map(async (d) => {
          await persistDecision(d);
          await persistStreamLog({
            id: `log_${d.id}`,
            message: d.pipelinePath,
            raw: JSON.stringify({
              txn_id: d.txnId,
              stage: d.stages.map((s) => s.label),
              outcome: d.outcome,
              p_fraud: d.pFraud,
            }),
            timestamp: d.timestamp,
          });
        }),
      );
    };

    timerRef.current = setInterval(() => {
      void tick();
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [streamingLive, ingestBatch]);
}
