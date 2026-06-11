'use client';

import { PageWrapper } from '@/components/layout/page-wrapper';
import { useEffect, useState } from 'react';
import { Database, Layers, Radio, Server } from 'lucide-react';
import { useSimulationStore } from '@/lib/stores/simulation-store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { INFRA_SERVICES } from '@/lib/constants/policies';
import { MetricCard } from '@/components/dashboard/metric-card';
import { db } from '@/lib/db';
import { formatCompact } from '@/lib/format';
import { HealthGrid } from '@/components/dashboard/health-grid';

const TOPICS = [
  { topic: 'txn.inbound', partitions: 12, mps: 4820, lag: 0, status: 'Healthy' },
  { topic: 'txn.enriched', partitions: 12, mps: 4810, lag: 0, status: 'Healthy' },
  { topic: 'decisions.output', partitions: 6, mps: 4801, lag: 19, status: 'Lagging' },
  { topic: 'audit.events', partitions: 3, mps: 1200, lag: 0, status: 'Healthy' },
];

export default function InfrastructurePage() {
  const { metrics } = useSimulationStore();
  const streamingLive = useWorkspaceStore((s) => s.streamingLive);
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
    <PageWrapper>
      <header className="mb-6">
        <p className="metric-label text-brand-primary">Workspace</p>
        <h1 className="text-display">Infrastructure Observability</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Events / Sec" value={formatCompact(metrics.eventsPerSec)} icon={Radio} status="green" />
        <MetricCard label="Partition Lag" value={`${metrics.consumerLag} ms`} icon={Layers} status={metrics.consumerLag > 500 ? 'yellow' : 'green'} />
        <MetricCard label="Consumer Clusters" value="12" icon={Server} status="green" />
        <MetricCard label="Kafka Offset" value={formatCompact(metrics.kafkaOffset)} icon={Database} status="green" />
      </div>

      <div className="mt-6">
        <HealthGrid />
      </div>

      <div className="mt-6 surface-card overflow-hidden">
        <table className="w-full text-left text-small">
          <thead>
            <tr className="border-b border-bg-border font-mono text-micro uppercase text-text-muted">
              <th className="px-4 py-3">Topic</th>
              <th className="px-4 py-3">Partitions</th>
              <th className="px-4 py-3">Messages/s</th>
              <th className="px-4 py-3">Lag</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {TOPICS.map((t) => (
              <tr
                key={t.topic}
                className={`border-b border-bg-border/60 ${
                  t.lag > 5000 ? 'bg-semantic-block/10' : t.lag > 500 ? 'bg-semantic-stepup/10' : ''
                }`}
              >
                <td className="px-4 py-2 font-mono text-micro">{t.topic}</td>
                <td className="px-4 py-2">{t.partitions}</td>
                <td className="px-4 py-2 font-mono">{t.mps.toLocaleString()}</td>
                <td className="px-4 py-2 font-mono">{t.lag}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      t.status === 'Healthy'
                        ? 'text-semantic-approve'
                        : t.status === 'Lagging'
                          ? 'text-semantic-stepup'
                          : 'text-semantic-block'
                    }
                  >
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 surface-card p-4">
        <p className="metric-label mb-3">Wire monitor</p>
        <div className="max-h-64 overflow-y-auto rounded-lg border border-bg-border bg-bg-base p-4 font-mono text-micro text-chart-5">
          {!streamingLive ? (
            <p className="text-text-muted">{'// stream frozen'}</p>
          ) : wireLogs.length === 0 ? (
            <p className="text-text-muted">{'// awaiting logs…'}</p>
          ) : (
            wireLogs.map((line, i) => <div key={i}>{line}</div>)
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {INFRA_SERVICES.map((s) => (
          <div key={s.name} className="surface-card flex items-center justify-between px-4 py-3">
            <span className="text-small">{s.name}</span>
            <span className="font-mono text-micro text-semantic-approve">{s.status}</span>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}
