'use client';

import { Activity, Brain, Shield, Timer, Zap } from 'lucide-react';
import { useSimulationStore } from '@/lib/stores/simulation-store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { MetricCard } from '@/components/dashboard/metric-card';
import { formatCurrency } from '@/lib/format';

export function MissionControl() {
  const { metrics } = useSimulationStore();
  const streamingLive = useWorkspaceStore((s) => s.streamingLive);

  const spark = metrics.throughputHistory.slice(-20).map((p) => ({ v: p.eps }));

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard
        label="Fraud Prevented"
        numericValue={metrics.fraudPreventedUsd}
        prefix="₹"
        icon={Shield}
        status="green"
        sparkline={spark}
      />
      <MetricCard
        label="Transactions Analysed"
        numericValue={metrics.transactionsAnalyzed}
        icon={Activity}
        status={streamingLive ? 'green' : 'yellow'}
        sparkline={spark}
      />
      <MetricCard
        label="AI Confidence"
        value={`${(metrics.modelConfidence * 100).toFixed(1)}%`}
        icon={Brain}
        status="green"
      />
      <MetricCard
        label="Decision Latency p95"
        value={`${metrics.p95LatencyMs.toFixed(1)}ms`}
        icon={Timer}
        status={metrics.p95LatencyMs < 12 ? 'green' : 'yellow'}
      />
      <MetricCard
        label="Throughput"
        numericValue={metrics.eventsPerSec}
        suffix="/s"
        icon={Zap}
        status="green"
        sparkline={spark}
      />
    </div>
  );
}
