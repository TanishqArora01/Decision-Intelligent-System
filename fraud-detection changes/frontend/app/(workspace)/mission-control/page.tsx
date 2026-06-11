'use client';

import { PageWrapper } from '@/components/layout/page-wrapper';
import { MissionControl } from '@/components/dashboard/mission-control';
import { StreamPipeline } from '@/components/dashboard/stream-pipeline';
import { HealthGrid } from '@/components/dashboard/health-grid';
import { DecisionFeedPanel } from '@/components/fraud/decision-feed-panel';
import { ThroughputPanel } from '@/components/dashboard/throughput-panel';

export default function MissionControlPage() {
  return (
    <PageWrapper>
      <header className="mb-6">
        <p className="metric-label text-brand-primary">Workspace</p>
        <h1 className="text-display">Mission Control</h1>
      </header>

      <MissionControl />

      <div className="mt-6 space-y-6">
        <StreamPipeline />
        <div className="grid gap-6 lg:grid-cols-[1.65fr_1fr]">
          <DecisionFeedPanel />
          <ThroughputPanel />
        </div>
        <HealthGrid />
      </div>
    </PageWrapper>
  );
}
