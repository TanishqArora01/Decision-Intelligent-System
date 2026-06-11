import type {
  AmlCategory,
  BehavioralSignals,
  DecisionOutcome,
  PipelineDecision,
  ShapFeature,
  StageTrace,
} from './types';

const THETA_LOW = 0.12;
const THETA_HIGH = 0.72;

const MERCHANTS = ['AMZN', 'UBER', 'COINBASE', 'WISE', 'STRIPE', 'PAYPAL'];
const CURRENCIES = ['USD', 'EUR', 'GBP'];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function mockBiometrics(): BehavioralSignals {
  return {
    typingCadenceMs: rand(80, 420),
    hesitationPauses: Math.floor(rand(0, 8)),
    copyPasteVelocity: rand(0, 1),
    activePhoneCall: Math.random() < 0.08,
  };
}

function mockShap(pFraud: number): ShapFeature[] {
  const base = [
    { feature: 'velocity_24h', contribution: rand(0.05, 0.22) * pFraud },
    { feature: 'device_trust', contribution: -rand(0.02, 0.15) },
    { feature: 'geo_distance_km', contribution: rand(0, 0.18) * pFraud },
    { feature: 'graph_cluster_risk', contribution: rand(0, 0.2) * pFraud },
    { feature: 'biometric_anomaly', contribution: rand(0, 0.12) },
  ];
  return base.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 5);
}

/** Stage 3 cost-minimization routing */
function optimizeDecision(
  pFraud: number,
  clv: number,
  amount: number,
  deviceTrust: number,
  bioScore: number,
): DecisionOutcome {
  const fraudLoss = pFraud * amount;
  const frictionCost = clv * 0.02;
  const reviewCost = 4.5 + amount * 0.001;

  const blockUtility = fraudLoss - 0.1 * clv;
  const approveUtility = -fraudLoss + frictionCost * 0.1;
  const stepUpUtility = fraudLoss * 0.6 - frictionCost * 0.5;
  const reviewUtility = fraudLoss * 0.85 - reviewCost;

  const scores: [DecisionOutcome, number][] = [
    ['BLOCK', blockUtility + (bioScore > 0.6 ? 2 : 0)],
    ['APPROVE', approveUtility - pFraud * 20],
    ['STEP_UP_AUTH', stepUpUtility + (deviceTrust < 0.4 ? 1.5 : 0)],
    ['MANUAL_REVIEW', reviewUtility + (pFraud > 0.45 && pFraud < 0.75 ? 3 : 0)],
  ];

  if (pFraud > THETA_HIGH) return 'BLOCK';
  if (pFraud < THETA_LOW) return 'APPROVE';

  scores.sort((a, b) => b[1] - a[1]);
  return scores[0]![0];
}

function amlFromOutcome(outcome: DecisionOutcome, pFraud: number): { category: AmlCategory; score: number } {
  const score = pFraud * 0.7 + (outcome === 'BLOCK' ? 0.25 : outcome === 'MANUAL_REVIEW' ? 0.15 : 0);
  if (score > 0.75) return { category: 'SEVERE', score };
  if (score > 0.5) return { category: 'HIGH', score };
  if (score > 0.28) return { category: 'MEDIUM', score };
  return { category: 'LOW', score };
}

/** Full 4-stage pipeline for one synthetic transaction */
export function processTransaction(): PipelineDecision {
  const txnId = uid('TXN');
  const accountId = `ACC_${Math.floor(rand(10000, 99999))}`;
  const amount = Math.round(rand(12, 48000) * 100) / 100;
  const deviceTrust = rand(0.15, 0.98);
  const clv = rand(500, 85000);
  const bio = mockBiometrics();

  const stages: StageTrace[] = [];
  const t0 = performance.now();

  // Stage 1 — Fast Risk Estimation
  const pFraud = Math.min(0.99, Math.max(0.001, rand(0.02, 0.94) * (bio.activePhoneCall ? 1.35 : 1)));
  const uncertainty = rand(0.02, 0.18);
  const s1Ms = rand(2, 9);
  stages.push({
    stage: 1,
    label: 'Fast Risk Estimation',
    latencyMs: s1Ms,
    detail: `P(fraud)=${pFraud.toFixed(4)} σ=${uncertainty.toFixed(3)}`,
  });

  let earlyExit = false;
  let outcome: DecisionOutcome;
  let graphRisk = 0;
  let ensembleScore = 0;
  let biometricAnomaly = 0;

  if (pFraud < THETA_LOW) {
    earlyExit = true;
    outcome = 'APPROVE';
    stages.push({
      stage: 1,
      label: 'Early Exit',
      latencyMs: 0.4,
      detail: `θ_low bypass → APPROVE`,
    });
  } else {
    // Stage 2 — Deep Brain
    graphRisk = rand(0.1, 0.95);
    ensembleScore = rand(0.15, 0.92);
    biometricAnomaly =
      (bio.activePhoneCall ? 0.35 : 0) +
      bio.hesitationPauses * 0.04 +
      bio.copyPasteVelocity * 0.2 +
      (bio.typingCadenceMs > 300 ? 0.15 : 0);

    stages.push({
      stage: 2,
      label: 'Graph Intel (Neo4j)',
      latencyMs: rand(18, 45),
      detail: `cluster_risk=${graphRisk.toFixed(3)} shared_devices=${Math.floor(rand(1, 6))}`,
    });
    stages.push({
      stage: 2,
      label: 'ML Ensemble',
      latencyMs: rand(22, 55),
      detail: `xgb=${ensembleScore.toFixed(3)} dnn=${(ensembleScore * rand(0.9, 1.1)).toFixed(3)}`,
    });
    stages.push({
      stage: 2,
      label: 'Behavioral Biometrics',
      latencyMs: rand(8, 22),
      detail: `anomaly=${biometricAnomaly.toFixed(3)} phone=${bio.activePhoneCall}`,
    });

    // Stage 3 — Financial Decision Optimization
    const s3Ms = rand(5, 18);
    outcome = optimizeDecision(pFraud, clv, amount, deviceTrust, biometricAnomaly);
    stages.push({
      stage: 3,
      label: 'Cost Optimization',
      latencyMs: s3Ms,
      detail: `min E[loss]+E[friction]+E[review] → ${outcome}`,
    });
  }

  // Stage 4 — FRAML / AML
  const { category: amlCategory, score: amlScore } = amlFromOutcome(outcome, pFraud);
  stages.push({
    stage: 4,
    label: 'FRAML Convergence',
    latencyMs: rand(4, 12),
    detail: `AML=${amlCategory} score=${amlScore.toFixed(3)}`,
  });

  const totalLatencyMs = stages.reduce((s, x) => s + x.latencyMs, 0);
  const pipelinePath = earlyExit
    ? 'Ingest → Redpanda → Stage-1 Early Exit → FRAML'
    : 'Ingest → Redpanda → Behavioral Telemetry Sink → Stage 1-3 → FRAML';

  return {
    id: uid('DEC'),
    txnId,
    accountId,
    merchantId: pick(MERCHANTS),
    amount,
    currency: pick(CURRENCIES),
    deviceId: `DEV_${Math.floor(rand(1000, 9999))}`,
    ipAddress: `${Math.floor(rand(1, 255))}.${Math.floor(rand(0, 255))}.x.x`,
    pFraud,
    uncertainty,
    clv,
    outcome,
    earlyExit,
    pipelinePath,
    stages,
    shap: mockShap(pFraud),
    amlCategory,
    amlScore,
    totalLatencyMs,
    timestamp: Date.now(),
    graphRisk,
    ensembleScore,
    biometricAnomaly,
  };
}
