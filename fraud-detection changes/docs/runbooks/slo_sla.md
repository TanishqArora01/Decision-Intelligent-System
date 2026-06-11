# SLO / SLA Targets

## Service: Fraud Detection Decision Intelligence System
## Effective: 2024-06-01  |  Review: Quarterly

---

## Service Level Objectives (SLOs)

SLOs are internal targets that define what "good" looks like.
SLAs are external commitments to banking partners (subset of SLOs with consequences).

### 1. Availability

| Service | SLO | SLA | Measurement window |
|---|---|---|---|
| API Gateway (`/transaction`) | 99.9% | 99.5% | Rolling 30 days |
| App Backend (`/health`) | 99.9% | 99.5% | Rolling 30 days |
| Full pipeline (Stage 1+2+3) | 99.5% | 99.0% | Rolling 30 days |

**99.9% = ≤ 43 min downtime/month**
**99.5% = ≤ 3.6 hours downtime/month**

Downtime = any period where `up{job="api-gateway"} == 0` for > 1 minute.

---

### 2. Latency

| Metric | SLO | SLA | Notes |
|---|---|---|---|
| Stage 1 early exit p99 | < 15ms | < 30ms | LightGBM only path (~60% of traffic) |
| Full pipeline p95 | < 200ms | < 500ms | Includes Neo4j graph queries |
| Full pipeline p99 | < 1000ms | < 2000ms | Tail latency budget |
| Batch (100 txns) p95 | < 5s | < 10s | Concurrent async processing |

---

### 3. Fraud Detection Quality

| Metric | SLO | Alert threshold | Notes |
|---|---|---|---|
| Model AUC (val) | ≥ 0.93 | < 0.90 | Checked by governance DAG weekly |
| Block rate | 2–8% | < 0.5% or > 15% | Normal operating range |
| ICP coverage guarantee | ≥ 95% | < 94% | Conformal prediction calibration |
| False negative rate | ≤ 10% | > 15% | From chargeback feedback labels |
| Review queue SLA | ≤ 24h resolution | > 48h | Analyst response time for MANUAL_REVIEW |

---

### 4. Data Freshness

| Metric | SLO | Notes |
|---|---|---|
| Feature velocity lag | ≤ 100ms | Redis ZSET computation time |
| ClickHouse analytics lag | ≤ 5 min | Batch write from decision sink |
| Chargeback label ingestion | ≤ 30 min | Airflow DAG schedule |
| Model monitoring report | ≤ 6h | Drift detection DAG schedule |

---

## Error Budget

Error budget = 1 - SLO = time/capacity we can spend on incidents and planned downtime.

| SLO | Error budget per month |
|---|---|
| 99.9% availability | 43.2 minutes |
| 99.5% availability (SLA) | 3.6 hours |

**Error budget policy:**
- If error budget > 50% remaining: normal development velocity
- If error budget 25–50% remaining: freeze non-critical deploys, investigate trends
- If error budget < 25% remaining: incident review required, no new feature deploys
- If SLA breached: customer notification required within 24h, RCA within 72h

---

## SLA Reporting

Banking partner SLA reports are generated monthly and cover:
1. Availability uptime % (from Prometheus `up` metrics)
2. p95/p99 latency histograms
3. Decision volume and action distribution
4. Any SLA breach events with root cause

Report location: `s3://governance-reports/sla/{YYYY-MM}/`

---

## Measurement and Monitoring

All SLO metrics are measured by Prometheus and alerting rules in
`config/prometheus/alert_rules.yml`.

Grafana dashboards:
- **Fraud Ops Dashboard** (`http://localhost:3000`) — real-time view
- **SLO Overview** — monthly availability and latency burn rates

Alerting channels (configure in `config/grafana/provisioning/`):
- Slack: `#fraud-ops-alerts` (P3/P4)
- PagerDuty: on-call rotation (P1/P2)

---

## Exclusions

The following are excluded from SLA calculations:
1. Planned maintenance windows (announced ≥ 48h in advance)
2. Force majeure events (network provider outages, cloud region failures)
3. Customer-induced issues (malformed requests, DDoS from customer IP ranges)
4. Events during sandbox/non-production environments
