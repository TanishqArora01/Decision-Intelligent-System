export type DecisionOutcome = 'APPROVE' | 'BLOCK' | 'STEP_UP_AUTH' | 'MANUAL_REVIEW';

export type AmlCategory = 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';

export interface BehavioralSignals {
  typingCadenceMs: number;
  hesitationPauses: number;
  copyPasteVelocity: number;
  activePhoneCall: boolean;
}

export interface StageTrace {
  stage: 1 | 2 | 3 | 4;
  label: string;
  latencyMs: number;
  detail: string;
}

export interface ShapFeature {
  feature: string;
  contribution: number;
}

export interface PipelineDecision {
  id: string;
  txnId: string;
  accountId: string;
  merchantId: string;
  amount: number;
  currency: string;
  deviceId: string;
  ipAddress: string;
  pFraud: number;
  uncertainty: number;
  clv: number;
  outcome: DecisionOutcome;
  earlyExit: boolean;
  pipelinePath: string;
  stages: StageTrace[];
  shap: ShapFeature[];
  amlCategory: AmlCategory;
  amlScore: number;
  totalLatencyMs: number;
  timestamp: number;
  graphRisk: number;
  ensembleScore: number;
  biometricAnomaly: number;
}

export interface StreamLogEntry {
  id: string;
  message: string;
  raw: string;
  timestamp: number;
}

export interface SimulationMetrics {
  fraudPreventedUsd: number;
  transactionsAnalyzed: number;
  modelConfidence: number;
  p95LatencyMs: number;
  eventsPerSec: number;
  consumerLag: number;
  kafkaOffset: number;
  outcomes: Record<DecisionOutcome, number>;
  throughputHistory: { t: number; eps: number }[];
  fraudTrend24h: { hour: string; rate: number }[];
  catchRateHistory: { t: number; volume: number; catchRate: number }[];
  latencySamples: number[];
}
