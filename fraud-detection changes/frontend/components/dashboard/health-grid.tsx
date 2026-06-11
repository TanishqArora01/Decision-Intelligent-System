'use client';

const SERVICES: { name: string; ms: number }[] = [
  { name: 'Redpanda', ms: 6 },
  { name: 'Feature Engine', ms: 8 },
  { name: 'Stage 1', ms: 5 },
  { name: 'Stage 2', ms: 11 },
  { name: 'Stage 3', ms: 9 },
  { name: 'Decision Sink', ms: 7 },
  { name: 'AI Layer', ms: 10 },
  { name: 'Gateway', ms: 4 },
];

export function HealthGrid() {
  return (
    <div className="surface-card p-5">
      <p className="metric-label mb-4">Service health</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SERVICES.map((s) => (
          <div key={s.name} className="flex items-center justify-between rounded-lg border border-bg-border bg-bg-elevated px-3 py-2">
            <span className="text-small">{s.name}</span>
            <span className="flex items-center gap-1.5 font-mono text-micro text-semantic-approve">
              <span className="h-2 w-2 rounded-full bg-semantic-approve" />
              {s.ms}ms
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
