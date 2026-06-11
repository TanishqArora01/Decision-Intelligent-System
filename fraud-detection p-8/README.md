# Fraud Detection Decision Intelligence System

Single-machine fraud orchestration stack for synthetic transaction generation, streaming feature engineering, multi-stage scoring, action execution, monitoring, and continuous learning.

## Architecture

```text
source-generator -> Redpanda -> feature-engine -> Redis / MinIO
                                  |
                                  v
                       stage1-fast-risk (fast exit)
                                  |
                                  v
                   stage2-deep-intelligence (graph + anomaly)
                                  |
                                  v
                   stage3-decision-engine (cost + A/B + review)
                                  |
                                  v
                    action-execution -> decision-sinks
                                  |
                                  v
                    feedback-loop -> Airflow retraining
```

## Folder Map

- [source-generator/](source-generator) - synthetic transaction producer
- [feature-engine/](feature-engine) - streaming feature computation and online/offline store writes
- [stage1-fast-risk/](stage1-fast-risk) - low-latency risk model and early exit
- [stage2-deep-intelligence/](stage2-deep-intelligence) - XGBoost, MLP, Neo4j graph scoring, anomaly detection
- [stage3-decision-engine/](stage3-decision-engine) - cost-based decisioning, A/B logic, step-up and review routing
- [action-execution/](action-execution) - execution service for approve, block, step-up, and manual review
- [decision-sinks/](decision-sinks) - persistence into PostgreSQL and ClickHouse
- [feedback-loop/](feedback-loop) - label ingestion, drift detection, retraining support
- [api-gateway/](api-gateway) - service entry point and orchestration API
- [config/](config) - infra configuration for Redpanda, Redis, PostgreSQL, ClickHouse, Neo4j, Flink, Prometheus, Grafana
- [dags/](dags) - Airflow retraining and monitoring workflows
- [scripts/](scripts) - bootstrap scripts for topics, databases, and buckets

## What Is Implemented

- Synthetic transaction generation with configurable fraud patterns.
- Streaming feature engineering with online feature store support.
- Stage 1 fast-risk scoring with early approval routing.
- Stage 2 deep intelligence with graph risk and anomaly signals.
- Stage 3 cost-aware decisioning with A/B and shadow-mode support.
- Action execution for final approve, block, step-up, and manual-review flows.
- Decision sinks for operational and analytical storage.
- Monitoring dashboards and alerting for pipeline health and model signals.
- Continuous learning through feedback ingestion, drift detection, and retraining.

## What Remains

- Full end-to-end load testing at target throughput.
- Production hardening of thresholds, alert tuning, and retry policies.
- Any remaining service-by-service integration checks after folder renames.
- Tighter documentation of API payloads and operational runbooks, if needed.

## Run the Stack

Typical workflow:

```bash
docker compose up -d redpanda redis postgres minio neo4j clickhouse
docker compose up -d feature-engine stage1-service stage2-service stage3-service action-engine decision-sink api-gateway
docker compose up -d airflow-webserver airflow-scheduler prometheus grafana
```

Validation can be done with the existing Makefile targets if you want the staged startup and health checks.

The external application entry point is the API gateway at http://localhost:8000.

## Core Ports

| Service | Port |
| --- | --- |
| Redpanda | 9092 |
| Redis | 6379 |
| PostgreSQL | 5432 |
| ClickHouse | 8123 |
| MinIO | 9001 |
| Neo4j | 7474 / 7687 |
| MLflow | 5000 |
| Airflow | 8080 |
| Prometheus | 9090 |
| Grafana | 3000 |

## Notes

- The repository has been reorganized so the top-level service folders now match the architecture naming.
- Compose and DAG references should follow the renamed folders in this tree.
- If you change a service folder again, update the matching compose build context and Airflow mount path in the same pass.
