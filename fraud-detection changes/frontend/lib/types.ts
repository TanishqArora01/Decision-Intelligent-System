// lib/types.ts — TypeScript types matching app-backend schemas

export type Role = 'ANALYST' | 'OPS_MANAGER' | 'ADMIN' | 'BANK_PARTNER';
export type Action = 'APPROVE' | 'BLOCK' | 'STEP_UP_AUTH' | 'MANUAL_REVIEW';
export type CaseStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'ESCALATED';
export type CaseVerdict = 'CONFIRMED_FRAUD' | 'FALSE_POSITIVE' | 'INCONCLUSIVE';

export interface AuthUser {
  id:       string;
  username: string;
  email:    string;
  role:     Role;
  org_id:   string | null;
}

export interface TokenResponse {
  access_token:  string;
  refresh_token: string;
  token_type:    string;
  role:          Role;
  username:      string;
}

export interface Decision {
  txn_id:           string;
  customer_id:      string;
  amount:           number;
  currency:         string;
  action:           Action;
  p_fraud:          number;
  confidence:       number;
  graph_risk_score: number;
  anomaly_score:    number;
  optimal_cost:     number;
  model_version:    string;
  ab_variant:       string;
  latency_ms:       number;
  decided_at:       string;
  explanation:      Record<string, string>;
}

export interface ReviewCase {
  id:               string;
  txn_id:           string;
  customer_id:      string;
  amount:           number;
  currency:         string;
  channel:          string;
  country_code:     string;
  p_fraud:          number;
  confidence:       number;
  graph_risk_score: number;
  anomaly_score:    number;
  model_action:     Action;
  model_version:    string;
  explanation:      Record<string, string>;
  status:           CaseStatus;
  priority:         1 | 2 | 3;
  assigned_to:      string | null;
  verdict:          CaseVerdict | null;
  analyst_notes:    string;
  created_at:       string;
  updated_at:       string;
}

export interface PagedResponse<T> {
  items:     T[];
  total:     number;
  page:      number;
  page_size: number;
  pages:     number;
}

export interface OverviewStats {
  total_decisions:  number;
  blocked:          number;
  approved:         number;
  step_up:          number;
  manual_review:    number;
  avg_p_fraud:      number;
  block_rate_pct:   number;
  avg_latency_ms:   number;
  p95_latency_ms:   number;
}

export interface FraudRateBucket {
  bucket:         string;
  total:          number;
  blocked:        number;
  approved:       number;
  step_up:        number;
  manual_review:  number;
  block_rate_pct: number;
  avg_p_fraud:    number;
  avg_latency_ms: number;
}

export interface SSEDecision {
  type:        'decision' | 'connected' | 'keepalive';
  txn_id?:     string;
  customer_id?:string;
  amount?:     number;
  currency?:   string;
  action?:     Action;
  p_fraud?:    number;
  graph_risk?: number;
  anomaly?:    number;
  latency_ms?: number;
  decided_at?: string;
}
