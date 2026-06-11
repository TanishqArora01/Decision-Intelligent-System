export interface PolicyRow {
  name: string;
  stage: string;
  status: 'ACTIVE' | 'SHADOW' | 'DISABLED';
  hits24h: number;
}

export const SEEDED_POLICIES: PolicyRow[] = [
  { name: 'High-Velocity Capital Burst', stage: 'Stage 1', status: 'ACTIVE', hits24h: 1421 },
  { name: 'Cross-Border Geo Impossibility', stage: 'Stage 2', status: 'ACTIVE', hits24h: 94 },
  { name: 'Coerced User Behavioral Anomaly', stage: 'Stage 2', status: 'ACTIVE', hits24h: 12 },
  { name: 'Synthetic Profile / Ghost Identity', stage: 'Stage 2', status: 'ACTIVE', hits24h: 4 },
  { name: 'Cost-Optimized Auto-Block', stage: 'Stage 3', status: 'ACTIVE', hits24h: 608 },
];

export const INFRA_SERVICES = [
  { name: 'Redpanda Cluster', status: 'HEALTHY' as const },
  { name: 'Feast Feature Store', status: 'HEALTHY' as const },
  { name: 'Stage 1-3 Logic Core', status: 'HEALTHY' as const },
  { name: 'FRAML Compliance Sink', status: 'HEALTHY' as const },
];
