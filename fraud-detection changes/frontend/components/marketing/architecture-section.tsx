'use client';

import { motion } from 'framer-motion';

const NODES = ['Bank', 'Gateway', 'Feature Engine', 'Stage 1', 'Stage 2', 'Stage 3', 'Decision'];

export function ArchitectureSection() {
  return (
    <section id="architecture" className="mx-auto max-w-content px-6 py-24">
      <p className="metric-label text-brand-primary">Architecture</p>
      <h2 className="mt-2 text-display">End-to-end decision mesh</h2>
      <div className="mt-12 overflow-x-auto rounded-xl border border-bg-border bg-bg-surface p-8">
        <svg viewBox="0 0 900 120" className="w-full min-w-[600px]">
          {NODES.map((n, i) => {
            const x = 40 + i * 120;
            return (
              <g key={n}>
                {i > 0 && (
                  <line
                    x1={x - 70}
                    y1={60}
                    x2={x - 50}
                    y2={60}
                    stroke="rgba(99,102,241,0.4)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    style={{ animation: 'dash 2s linear infinite' }}
                  />
                )}
                <motion.rect
                  x={x - 45}
                  y={35}
                  width={90}
                  height={50}
                  rx={8}
                  fill="var(--bg-elevated)"
                  stroke="var(--brand-primary)"
                  strokeWidth={1}
                  initial={{ opacity: 0.3 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ delay: i * 0.15 }}
                  viewport={{ once: true }}
                />
                <text x={x} y={65} textAnchor="middle" fill="var(--text-secondary)" fontSize={11}>
                  {n}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
