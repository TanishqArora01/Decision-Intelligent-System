'use client';

import { motion } from 'framer-motion';
import { useSimulationStore } from '@/lib/stores/simulation-store';

const NODES = ['Redpanda', 'Feature Engine', 'Stage 1', 'Stage 2', 'Stage 3', 'Decision Sink'];

export function StreamPipeline() {
  const eps = useSimulationStore((s) => s.metrics.eventsPerSec);

  return (
    <div className="surface-card overflow-hidden p-6">
      <p className="metric-label mb-4">Live stream pipeline</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {NODES.map((n, i) => (
          <div key={n} className="flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2, delay: i * 0.2 }}
              className="relative rounded-lg border border-brand-primary/30 bg-bg-elevated px-3 py-2 text-center"
            >
              <p className="text-micro font-medium">{n}</p>
              <p className="mt-1 font-mono text-micro text-brand-primary">
                {i === 0 ? `${eps || 0}/s` : '—'}
              </p>
              <span className="absolute -inset-1 rounded-lg ring-1 ring-brand-primary/20" />
            </motion.div>
            {i < NODES.length - 1 && (
              <span className="hidden text-brand-primary sm:inline">──►</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
