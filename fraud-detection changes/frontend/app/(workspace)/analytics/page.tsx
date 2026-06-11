'use client';

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Gauge, Timer } from 'lucide-react';
import { useSimulationStore } from '@/lib/stores/simulation-store';
import { MetricCard } from '@/components/dashboard/metric-card';
import { PageWrapper } from '@/components/layout/page-wrapper';

export default function AnalyticsPage() {
  const { metrics } = useSimulationStore();
  const sorted = [...metrics.latencySamples].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 4.2;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? metrics.p95LatencyMs;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 12.8;
  const avgOverhead = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 6.1;

  return (
    <PageWrapper>
      <header className="mb-6">
        <p className="metric-label text-brand-primary">Workspace</p>
        <h1 className="text-display">Analytics</h1>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="P50 Latency" value={`${p50.toFixed(1)}ms`} icon={Timer} status="green" />
        <MetricCard label="P95 Latency" value={`${p95.toFixed(1)}ms`} icon={Timer} status="yellow" />
        <MetricCard label="P99 Latency" value={`${p99.toFixed(1)}ms`} icon={Timer} status="red" />
        <MetricCard label="Avg Compute Overhead" value={`${avgOverhead.toFixed(1)}ms`} icon={Gauge} status="green" />
      </div>
      <div className="mt-6 surface-card p-4">
        <p className="metric-label mb-3">Volumetric scale vs catch-rate</p>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={metrics.catchRateHistory}>
            <CartesianGrid stroke="rgba(148,163,184,0.08)" />
            <XAxis dataKey="t" hide />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }} />
            <Bar yAxisId="left" dataKey="volume" fill="var(--chart-2)" fillOpacity={0.35} />
            <Line yAxisId="right" type="monotone" dataKey="catchRate" stroke="var(--chart-3)" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </PageWrapper>
  );
}
