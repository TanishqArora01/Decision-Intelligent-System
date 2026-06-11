import { create } from 'zustand';
import type { DecisionOutcome, PipelineDecision, SimulationMetrics } from '@/lib/pipeline/types';

const emptyOutcomes = (): Record<DecisionOutcome, number> => ({
  APPROVE: 0,
  BLOCK: 0,
  STEP_UP_AUTH: 0,
  MANUAL_REVIEW: 0,
});

const initialMetrics = (): SimulationMetrics => ({
  fraudPreventedUsd: 2_847_320,
  transactionsAnalyzed: 0,
  modelConfidence: 0.998,
  p95LatencyMs: 7.4,
  eventsPerSec: 0,
  consumerLag: 0,
  kafkaOffset: 1847291,
  outcomes: emptyOutcomes(),
  throughputHistory: [],
  fraudTrend24h: Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    rate: 0.8 + Math.random() * 2.2,
  })),
  catchRateHistory: [],
  latencySamples: [],
});

interface SimulationState {
  metrics: SimulationMetrics;
  recentDecisions: PipelineDecision[];
  streamTicker: { id: string; message: string; path: string; time: string }[];
  ingestPaused: boolean;
  setIngestPaused: (v: boolean) => void;
  ingestBatch: (decisions: PipelineDecision[]) => void;
  resetIfNeeded: () => void;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  metrics: initialMetrics(),
  recentDecisions: [],
  streamTicker: [],
  ingestPaused: false,
  setIngestPaused: (ingestPaused) => set({ ingestPaused }),
  resetIfNeeded: () => {
    /* no-op placeholder for future session reset */
  },
  ingestBatch: (decisions) => {
    if (!decisions.length) return;
    set((state) => {
      const m = { ...state.metrics };
      const outcomes = { ...m.outcomes };

      let prevented = 0;
      const latencies: number[] = [];

      for (const d of decisions) {
        m.transactionsAnalyzed += 1;
        outcomes[d.outcome] = (outcomes[d.outcome] ?? 0) + 1;
        latencies.push(d.totalLatencyMs);
        if (d.outcome === 'BLOCK') prevented += d.amount;
      }

      m.fraudPreventedUsd += prevented;
      m.outcomes = outcomes;
      m.eventsPerSec = Math.round(decisions.length / 0.1);
      m.consumerLag = Math.max(0, Math.floor(Math.random() * 120 - 20));
      m.kafkaOffset += decisions.length;
      m.modelConfidence = Math.min(0.999, 0.992 + Math.random() * 0.007);

      const allLat = [...state.metrics.latencySamples, ...latencies].slice(-500);
      allLat.sort((a, b) => a - b);
      m.p95LatencyMs = allLat[Math.floor(allLat.length * 0.95)] ?? 7.4;
      m.latencySamples = allLat;

      const now = Date.now();
      const throughputHistory = [
        ...m.throughputHistory,
        { t: now, eps: m.eventsPerSec },
      ].slice(-60);

      const catchRate =
        decisions.filter((d) => d.outcome !== 'APPROVE').length / Math.max(1, decisions.length);
      const catchRateHistory = [
        ...m.catchRateHistory,
        { t: now, volume: m.transactionsAnalyzed, catchRate: catchRate * 100 },
      ].slice(-40);

      const ticker = decisions.map((d) => ({
        id: d.id,
        message: `${d.outcome} · ${d.txnId} · $${d.amount.toFixed(2)} · P(fraud) ${(d.pFraud * 100).toFixed(1)}%`,
        path: d.pipelinePath,
        time: new Date(d.timestamp).toLocaleTimeString(),
      }));

      return {
        metrics: {
          ...m,
          throughputHistory,
          catchRateHistory,
        },
        recentDecisions: [...decisions, ...state.recentDecisions].slice(0, 300),
        streamTicker: [...ticker, ...state.streamTicker].slice(0, 50),
      };
    });
  },
}));
