# Model Governance Board — Process Documentation

## Service: Fraud Detection Decision Intelligence System
## Version: 1.0.0  |  Review: Quarterly

---

## Overview

The Model Governance Board (MGB) is responsible for approving all Production
model promotions, reviewing model performance, and ensuring the ML system
operates within agreed safety and fairness constraints.

**Meeting cadence:** Weekly (Sundays, triggered by governance DAG) + ad-hoc for P1 events.

---

## Roles and Responsibilities

| Role | Person | Responsibilities |
|---|---|---|
| **Board Chair** | ADMIN user | Final approval authority, rollback decisions |
| **ML Lead** | OPS_MANAGER | Presents model performance metrics, recommends promotions |
| **Fraud Analyst** | ANALYST | Reviews false negative/positive trends, customer impact |
| **Bank Partner Observer** | BANK_PARTNER | Read-only view of model cards and performance |

---

## Model Promotion Process

### Automatic path (low-risk changes)

1. Retraining DAG runs (`model_retraining` — daily 02:00 UTC)
2. New model registered in MLflow as `Staging`
3. `model_monitoring` DAG compares Staging vs Production (champion/challenger)
4. If `PROMOTE_CHALLENGER` recommendation **and** AUC improvement ≥ 0.01:
   - ML Lead approves via API: `POST /governance/approve-model`
   - Model promoted to Production automatically
   - Audit entry created in `audit.events`

### Manual approval path (significant changes)

Required when **any** of:
- Model architecture changed (new features, new ensemble weights)
- Training data distribution changed significantly (new fraud patterns added)
- AUC delta > 0.05 (large changes warrant more scrutiny)
- fn_rate > 0.12 in validation (close to the 0.15 threshold)

Steps:
1. ML Lead prepares model card via `GET /governance/model-cards/{model_name}`
2. Board reviews card in weekly meeting (or async Slack thread)
3. Board Chair approves via `POST /governance/approve-model` with written justification
4. Promotion logged to audit, bank partner notified if material change

---

## Approval Checklist

Before approving any model promotion, confirm:

- [ ] `val_auc` ≥ 0.90 (hard gate — system enforces this)
- [ ] `fn_rate` ≤ 0.15 (hard gate — system enforces this)
- [ ] Champion/challenger comparison completed (AUC delta, McNemar's p-value)
- [ ] Model card generated and reviewed
- [ ] No significant fairness disparity across `customer_segment` groups
- [ ] Conformal prediction calibration verified (ICP coverage ≥ 95%)
- [ ] Feature drift PSI < 0.10 for all 18 features (no pre-promotion drift)
- [ ] Rollback plan confirmed (previous version available in MLflow)

---

## Rollback Triggers

Automatic rollback is **not** implemented — all rollbacks require human decision.

**Criteria that should trigger rollback consideration:**

| Signal | Threshold | Action |
|---|---|---|
| Block rate spike | > 15% sustained 30+ min | Review + possible rollback |
| Block rate drop | < 0.5% sustained 15+ min | Likely rollback |
| Model AUC alert fires | AUC < 0.90 | Immediate rollback |
| Chargeback spike | > 3× baseline over 24h | Board review within 4h |
| False negative rate | > 15% on labeled batch | Rollback + emergency retrain |

**Rollback procedure:**
```bash
# Via API (ADMIN only)
curl -X POST http://localhost:8400/governance/rollback \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "model_name": "stage2_xgboost",
    "reason": "Block rate dropped below 0.5% — possible model degradation"
  }'

# Or via Makefile
make app-rollback
```

Rollback is logged to `audit.events` with actor, timestamp, and reason.
Previous version is restored from MLflow registry (no retraining needed).

---

## Model Card Review Criteria

Each model card must include and be reviewed for:

1. **Intended use** — fraud scoring only, not credit or identity
2. **Training data stats** — fraud rate, label sources, feature groups
3. **Evaluation metrics** — AUC, precision, recall, F1, FNR
4. **Fairness analysis** — error rate parity across customer segments
5. **Known limitations** — cold-start, new fraud pattern gaps
6. **Governance metadata** — approved_by, approved_at, justification

Generate and view model cards:
```bash
# All models
make app-model-cards

# Via API
GET /governance/model-cards
GET /governance/model-cards/stage1_lgbm
```

---

## Weekly Governance Report

The `model_governance` Airflow DAG (Sundays 03:00 UTC) produces:
- Model cards for all Production models
- Champion/challenger comparison for any Staging candidates
- Governance summary: `any_challenger_ready`, `all_models_reviewed`

Report written to: `s3://governance-reports/weekly/{YYYY-MM-DD}/governance_report.json`

Board reviews this report async every Monday morning.

---

## Audit Trail

Every governance action is recorded in `audit.events`:

```sql
SELECT event_type, entity_id, actor, payload, created_at
FROM audit.events
WHERE event_type IN ('MODEL_APPROVED', 'MODEL_ROLLBACK', 'MODEL_COMPARISON',
                     'MODEL_CARD_GENERATED', 'GOVERNANCE_REPORT')
ORDER BY created_at DESC
LIMIT 20;
```

All audit records are immutable and retained for 7 years per banking compliance requirements.

---

## Quarterly Board Review

Every quarter the board conducts a deeper review covering:
1. SLO performance vs targets (from `docs/runbooks/slo_sla.md`)
2. Cumulative model drift trends (PSI history from monitoring DAG)
3. Chargeback rate trends (model accuracy on real fraud)
4. Fairness audit (FNR/FPR by segment from ClickHouse)
5. Security review (unusual API key usage, auth failures from audit.events)
6. Feature importance stability (top features consistent with domain knowledge)

Output: quarterly governance report stored in MinIO + shared with bank partners.
