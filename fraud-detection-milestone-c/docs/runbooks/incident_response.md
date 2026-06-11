# Incident Response Runbook

## Service: Fraud Detection Decision Intelligence System
## Version: 1.0.0  |  Last updated: 2024-06-15

---

## Severity Levels

| Severity | Definition | Response time | Example |
|---|---|---|---|
| **P1 Critical** | Complete scoring unavailable | 15 min | Gateway down, Stage 3 down |
| **P2 High** | Degraded scoring (partial pipeline) | 30 min | Stage 2 down, Redis down |
| **P3 Warning** | Performance degradation | 2 hours | p95 > 200ms, block rate anomaly |
| **P4 Info** | Non-urgent anomaly | Next business day | Disk usage > 85% |

---

## Contacts

| Role | Contact | Escalation |
|---|---|---|
| On-call Ops | ops1 (OPS_MANAGER) | fraud-ops channel |
| ML Lead | analyst1 (ANALYST) | ml-team channel |
| Admin | admin (ADMIN) | direct message |

---

## Alert Playbooks

### gateway-down

**Alert:** `GatewayDown` — API Gateway unreachable > 1 min

**Impact:** All fraud scoring is unavailable. Upstream systems receive 503 errors.

**Diagnosis:**
```bash
# Check container status
docker ps | grep fraud_api_gateway

# Check logs
make gateway-logs

# Test health directly
curl -f http://localhost:8000/health

# Check upstream dependencies (Stage 1/2/3 must be healthy)
curl http://localhost:8000/ready
```

**Resolution:**
```bash
# Restart the gateway
docker restart fraud_api_gateway

# If still failing, rebuild
make up-gateway

# If dependencies are unhealthy, check them first
make validate-all
```

**Escalate if:** Gateway health check still fails after restart + rebuild (→ P1).

---

### stage-down

**Alert:** `Stage1Down`, `Stage2Down`, or `Stage3Down`

**Impact:**
- Stage 1 down → full pipeline unavailable (Stage 1 is required for routing)
- Stage 2 down → decisions fall back to Stage 1 score only (reduced accuracy)
- Stage 3 down → all decisions default to MANUAL_REVIEW (no APPROVE/BLOCK)

**Diagnosis:**
```bash
# Check the specific stage
docker ps | grep fraud_stage{1,2,3}
make stage{1,2,3}-logs

# Check if it's a model loading issue (Stage 1/2 train on startup)
docker logs fraud_stage1 2>&1 | grep -i "error\|training\|loaded"
```

**Resolution:**
```bash
# Restart — Stage 1/2 will retrain on startup
make up-stage1   # ~60s training time
make up-stage2   # ~3 min training time
make up-stage3   # instant

# Validate pipeline is flowing
make e2e-test
```

**Note:** Stage 1 and 2 train from scratch on startup using synthetic data. This is normal — no training data needs to be restored.

---

### latency-p95-high

**Alert:** `GatewayLatencyP95High` — p95 > 200ms

**Common causes:**

1. **Neo4j slow queries** (most common)
   ```bash
   # Check Neo4j query logs
   docker logs fraud_neo4j 2>&1 | grep -i "slow\|timeout" | tail -20

   # Check Neo4j browser at http://localhost:7474
   # Run: CALL db.stats.retrieve('GRAPH COUNTS')
   ```

2. **Stage 2 ensemble timeout**
   ```bash
   make stage2-logs | grep -i "timeout\|latency"
   ```

3. **Redis latency** (velocity feature computation)
   ```bash
   docker exec fraud_redis redis-cli --latency-history -i 1
   ```

**Resolution:**
```bash
# Neo4j: add query timeout if not present
# In stage2-service/graph/queries.py, timeout is already set to 5s

# Redis: check memory pressure
docker exec fraud_redis redis-cli info memory | grep used_memory_human

# Temporary: disable Neo4j queries (sets graph_risk_score=0)
# Set NEO4J_ENABLED=false in stage2-service env and restart
```

---

### block-rate-anomaly

**Alert:** `BlockRateTooHigh` (> 15%) or `BlockRateTooLow` (< 0.5%)

**Block rate too high (> 15%):**

Possible causes:
- Active fraud attack wave (correct — no action needed except monitor)
- Feature distribution shift causing model miscalibration
- Stage 3 cost function thresholds incorrectly configured

```bash
# Check if it's a real attack by looking at top-risk transactions
make clickhouse-fraud-rate

# Check if it's a model issue — compare p_fraud distribution
docker exec fraud_clickhouse clickhouse-client \
  --user fraud_admin --password fraud_secret_2024 \
  --query "SELECT quantile(0.5)(p_fraud), quantile(0.95)(p_fraud), count()
           FROM fraud_analytics.decisions
           WHERE decided_at > now() - INTERVAL 1 HOUR"
```

**Block rate too low (< 0.5%):**

This is more serious — model may have degraded.
```bash
# Check model AUC from MLflow
curl http://localhost:5000/api/2.0/mlflow/registered-models/get?name=stage1_lgbm

# Check if Stage 1 trained successfully (AUC should be > 0.93)
docker logs fraud_stage1 | grep "AUC"

# If model is degraded, trigger emergency retraining
docker exec fraud_airflow_scheduler airflow dags trigger model_retraining
```

---

### postgres-down

**Alert:** `PostgreSQLDown`

**Impact:** Audit trail writes fail, review queue unavailable, app-backend degraded.

**Diagnosis:**
```bash
docker ps | grep fraud_postgres
docker logs fraud_postgres --tail=50
docker exec fraud_postgres pg_isready -U fraud_admin
```

**Resolution:**
```bash
# Restart
docker restart fraud_postgres
sleep 5
docker exec fraud_postgres pg_isready -U fraud_admin

# If data is corrupt — restore from backup
./scripts/backup/restore_postgres.sh --list
./scripts/backup/restore_postgres.sh --latest
```

---

## Escalation Matrix

```
Alert fires → Ops Manager notified (Slack/PagerDuty)
  │
  ├── Resolved in < 30 min → log in audit.events, close
  │
  └── Not resolved in 30 min → escalate to ADMIN
        │
        └── Not resolved in 2h → invoke DR plan
```

---

## Post-Incident

After every P1/P2 incident, write a post-mortem within 48 hours covering:
1. Timeline (when detected, when resolved)
2. Root cause
3. Impact (decisions affected, duration)
4. Resolution steps taken
5. Prevention (what alert or code change prevents recurrence)

Post-mortems live in: `docs/post-mortems/YYYY-MM-DD-{title}.md`
