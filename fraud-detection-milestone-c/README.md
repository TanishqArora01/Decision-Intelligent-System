# Fraud Detection — Decision Intelligence System

Real-time fraud detection PoC. 3-stage cascading ML pipeline, 23 Docker
services, sub-200ms end-to-end latency, 1k–10k TPS, continuous learning.

---

## Architecture

```
Transaction → API Gateway (8000)
                  │
          Feature Engine
          18 features → Redis / MinIO
                  │
           Stage 1 (8100)
           LightGBM + ICP
                  │
        ┌─────────┴──────────┐
   EARLY EXIT            Stage 2 (8200)
   APPROVE (<10ms)       XGBoost + MLP + Neo4j + Anomaly
                              │
                         Stage 3 (8300)
                         argmin(cost) → APPROVE/BLOCK/STEP_UP/REVIEW
                              │
                    PostgreSQL + ClickHouse
                              │
                    Airflow (drift → retrain)
```

---

## Services (23 total)

| Service | Profile | Port | RAM |
|---|---|---|---|
| redpanda | core | 9092 | 1 GB |
| redis | core | 6379 | 1 GB |
| postgres | core | 5432 | 1 GB |
| clickhouse | data | 8123 | 4 GB |
| minio | data | 9002 | 512 MB |
| neo4j | data | 7474 | 2 GB |
| flink-jobmanager | compute | 8083 | 1 GB |
| flink-taskmanager | compute | — | 2 GB |
| mlflow | compute | 5000 | 512 MB |
| airflow-webserver | orchestration | 8080 | 1 GB |
| airflow-scheduler | orchestration | — | 512 MB |
| prometheus | monitoring | 9090 | 256 MB |
| grafana | monitoring | 3000 | 256 MB |
| generator | generator | 9101 | 512 MB |
| feature-engine | feature-engine | 9102 | 1 GB |
| stage1-service | stage1 | 8100 | 2 GB |
| stage2-service | stage2 | 8200 | 4 GB |
| stage3-service | stage3 | 8300 | 256 MB |
| decision-sink | sinks | — | 256 MB |
| api-gateway | gateway | 8000 | 512 MB |

**Total RAM: ~22 GB** (32 GB machine recommended)

---

## Quick Start

```bash
make setup        # copy .env.example → .env

make up-core      # Redpanda + Redis + PostgreSQL
make up-data      # ClickHouse + MinIO + Neo4j
make up-compute   # Flink + MLflow

make up-generator
make up-feature-engine

make up-stage1    # trains LightGBM on first start (~60s)
make up-stage2    # trains XGBoost + MLP + anomaly (~3 min)
make up-stage3

make up-sinks
make up-gateway
make up-monitoring
make up-orchestrate   # Airflow

make e2e-test     # run 8 integration test scenarios
```

Or all at once:

```bash
make up-all && sleep 180 && make e2e-test
```

---

## API

### POST /transaction

```bash
curl -X POST http://localhost:8000/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "txn_id": "t1", "customer_id": "c1",
    "amount": 150.0, "currency": "USD",
    "channel": "WEB", "device_id": "DEV-001",
    "ip_address": "1.2.3.4", "country_code": "IN",
    "clv": 12000.0, "trust_score": 0.75,
    "account_age_days": 365, "customer_segment": "standard"
  }'
```

Response fields: `action`, `p_fraud`, `confidence`, `optimal_cost_usd`,
`early_exit`, `pipeline_stage`, `e2e_latency_ms`, `explanation`.

### POST /transaction/batch — up to 100 transactions
### GET /health | /ready | /stats | /docs

---

## Cost Function (Stage 3)

```
action* = argmin E[Cost(action)]

APPROVE:       p_fraud × amount
BLOCK:         (1-p_fraud) × CLV × 0.001
STEP_UP_AUTH:  $2 + residual_fraud + abandonment_friction
MANUAL_REVIEW: $15 fixed
```

Hard rules (override cost engine):
- p_fraud > 0.95 → BLOCK
- p_raw < 0.02 → APPROVE
- uncertainty > 0.40 → MANUAL_REVIEW
- fraud_ring > 0.8 AND multi_hop > 0.5 → BLOCK

---

## 18 Features

| Group | Features |
|---|---|
| Velocity (8) | txn_count + amount_sum at 1m / 5m / 1h / 24h |
| Geography (3) | geo_velocity_kmh, is_new_country, unique_countries_24h |
| Device (4) | device_trust_score, is_new_device, ip_txn_count_1h, unique_devices_24h |
| Behavioral (3) | amount_vs_avg_ratio, merchant_familiarity, hours_since_last_txn |

---

## Neo4j Graph Patterns (Stage 2)

| Query | Signal |
|---|---|
| fraud_ring | Shared device/IP across multiple customers |
| mule_account | High in-degree (in/out ratio > 8) |
| synthetic_identity | Account age vs txn volume mismatch |
| velocity_graph | Burst edges in 5-minute window |
| multi_hop | 1–3 hop proximity to known fraud nodes |

---

## Continuous Learning

| DAG | Schedule | Purpose |
|---|---|---|
| chargeback_ingestion | Every 30 min | Chargebacks → fraud-labels Kafka |
| feature_snapshot | Every 1h | Verify MinIO snapshots exist |
| model_monitoring | Every 6h | PSI drift detection → trigger retraining |
| model_retraining | Daily 02:00 | Full retrain → MLflow promotion |

Retraining triggers: max_psi > 0.25, 3+ features drifted, FNR > 15%, FPR > 10%

---

## Performance Targets

| Metric | Target |
|---|---|
| Early exit latency | < 10ms |
| Full pipeline p95 | < 200ms |
| Throughput | 1k–10k TPS |
| Stage 1 AUC | > 0.93 |
| ICP coverage | ≥ 95% (guaranteed, α=0.05) |
| False negative rate | < 15% |

---

## Load Testing

```bash
# Constant TPS
python3 scripts/load_test.py --tps 500 --duration 30

# Ramp test
python3 scripts/load_test.py --tps 1000 --mode ramp --duration 60

# Spike test (baseline → 5× spike → recovery)
python3 scripts/load_test.py --tps 200 --mode spike
```

---

## Credentials

| Service | User | Password |
|---|---|---|
| PostgreSQL | fraud_admin | fraud_secret_2024 |
| MinIO | fraud_minio | fraud_minio_2024 |
| Neo4j | neo4j | fraud_neo4j_2024 |
| Airflow | admin | fraud_admin_2024 |
| Grafana | admin | fraud_grafana_2024 |

---

## Useful Commands

```bash
make demo                  # gateway demo: legit + card-testing
make stage1-predict        # test Stage 1 directly
make stage2-predict-ring   # test fraud ring path
make stage3-decide-ring    # test Stage 3 directly
make pg-decisions          # last 5 decisions in PostgreSQL
make clickhouse-fraud-rate # fraud rate by hour
make neo4j-fraud-rings     # customers sharing devices
make neo4j-seed            # load seed graph data
make gateway-stats         # live TPS + latency stats
```

---

## Project Structure

```
fraud-detection/
├── api-gateway/       single entry point (orchestrates all 3 stages)
├── feature-engine/    18-feature computation (Redis ZSET sliding windows)
├── stage1-service/    LightGBM + Inductive Conformal Prediction
├── stage2-service/    XGBoost + MLP + Neo4j (5 queries) + Anomaly detectors
├── stage3-service/    argmin(cost) decision engine + A/B experiments
├── sinks/             Kafka → PostgreSQL + ClickHouse dual-write
├── generator/         synthetic fraud data (6 patterns)
├── dags/              Airflow DAGs for continuous learning
├── feedback/          drift_detector.py, label_processor.py
├── feast/             feature store definitions
├── scripts/           e2e_test.py, load_test.py, init scripts
├── config/            Prometheus, Grafana, Flink, Redis, Neo4j
├── docker-compose.yml 23 services, 12 profiles
├── Makefile           all management commands
└── .env.example       all environment variables
```
