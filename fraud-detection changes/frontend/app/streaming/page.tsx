'use client';

import { useEffect, useState } from 'react';
import { Database, Layers, Radio, Server } from 'lucide-react';
import { useSimulationStore } from '@/lib/stores/simulation-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { INFRA_SERVICES } from '@/lib/constants/policies';
import { KpiCard } from '@/components/ui/kpi-card';
import { db } from '@/lib/db';
import { fmtNum } from '@/lib/utils';

export default function StreamingPage() {
  const { metrics } = useSimulationStore();
  const streamingLive = useUIStore((s) => s.streamingLive);
  const [wireLogs, setWireLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!streamingLive || !db) return;
    const id = setInterval(async () => {
      if (!db) return;
      const logs = await db.streamLogs.orderBy('timestamp').reverse().limit(12).toArray();
      setWireLogs(logs.map((l) => l.raw));
    }, 500);
    return () => clearInterval(id);
  }, [streamingLive]);

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">Workspace 04</p>
        <h1 className="font-display text-3xl font-semibold">Streaming Observability</h1>
        <p className="mt-1 text-sm text-text-secondary">Infrastructure telemetry across the decision pipeline mesh.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Events / Sec" value={fmtNum(metrics.eventsPerSec)} icon={Radio} accent="emerald" />
        <KpiCard label="Consumer Partition Lag" value={`${metrics.consumerLag} ms`} icon={Layers} accent="amber" />
        <KpiCard label="Active Consumer Clusters" value="12" icon={Server} accent="cyan" />
        <KpiCard label="Kafka Offset" value={fmtNum(metrics.kafkaOffset)} icon={Database} accent="cyan" />
      </div>

      <div className="glass-panel p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Network Topology Matrix</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {INFRA_SERVICES.map((s) => (
            <div
              key={s.name}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-bg-secondary px-4 py-3"
            >
              <span className="text-sm">{s.name}</span>
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                {s.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel overflow-hidden p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Wire Monitor</p>
        <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-800 bg-[#060a12] p-4 font-mono text-[11px] leading-relaxed text-emerald-400/90">
          {!streamingLive ? (
            <p className="text-text-muted">{'// stream frozen — enable Live Dashboard Ingestion in Settings'}</p>
          ) : wireLogs.length === 0 ? (
            <p className="text-text-muted">{'// awaiting structured transaction logs…'}</p>
          ) : (
            wireLogs.map((line, i) => (
              <div key={i} className="border-b border-slate-800/40 py-1 text-cyan-300/80">
                <span className="text-text-muted">{new Date().toLocaleTimeString()} </span>
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
