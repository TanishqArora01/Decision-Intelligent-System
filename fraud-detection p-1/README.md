# Fraud Detection — Decision Intelligence System
### Production PoC | Single-Machine Docker Microservices | 10k TPS target

---

## System Overview

A real-time, 3-stage cascading fraud detection pipeline built entirely on open-source tooling.
Every component is a separate Docker microservice — if one fails, the rest continue operating.

```
Transaction Sources
       |
   [Redpanda]  <─────────────────────────────────────────────────────┐
       |                                                              |
   [Flink] ──> [Redis: Online Store] + [MinIO: Offline Store]        |
       |                                                              |
  Stage 1: LightGBM (<10ms)                                          |
       |                                                              |
       ├─ p < theta_low ──> EARLY EXIT APPROVE ─────────────────────>|
       |                                                              |
       └─ uncertain ──> Stage 2: XGBoost + Neo4j + Autoencoder       |
                                  |                                   |
                         Stage 3: argmin(cost)                        |
                                  |                                   |
                      A/B Experimentation Engine                      |
                                  |                                   |
               Approve | Block | Step-Up | Review                     |
                                  |                                   |
               Airflow Feedback Loop + MLflow Retraining ─────────────┘
```

---

## Prerequisites

```bash
docker --version        # 24.x.x or newer
docker compose version  # v2.x.x or newer
# RAM: 32GB | CPU: 8 cores | Disk: 50GB free
```

---

## Quick Start — Layer by Layer

```bash
# 1. Setup
make setup

# 2. Core (Redpanda + Redis + PostgreSQL) — ~30s
make up-core && make validate-core

# 3. Data (ClickHouse + MinIO + Neo4j) — ~60s
make up-data && make validate-data

# 4. Compute (Flink + MLflow)
make up-compute && make validate-compute

# 5. Orchestration (Airflow)
make up-orchestrate

# 6. Monitoring (Prometheus + Grafana)
make up-monitoring

# Or start everything at once
make up-all && make validate-all
```

---

## Port Reference

| Service              | Port  | URL                          |
|----------------------|-------|------------------------------|
| Redpanda Kafka API   | 9092  | Bootstrap server             |
| Redpanda Admin       | 9644  | Admin API                    |
| Redpanda Schema Reg  | 8081  | Schema Registry              |
| Redis                | 6379  | Online Feature Store         |
| PostgreSQL           | 5432  | Transactions + Audit         |
| ClickHouse HTTP      | 8123  | Analytics queries            |
| MinIO S3 API         | 9001  | Feast Offline + MLflow       |
| MinIO Console        | 9002  | http://localhost:9002        |
| Neo4j Browser        | 7474  | http://localhost:7474        |
| Neo4j Bolt           | 7687  | bolt://localhost:7687        |
| Flink Web UI         | 8083  | http://localhost:8083        |
| MLflow UI            | 5000  | http://localhost:5000        |
| Airflow UI           | 8080  | http://localhost:8080        |
| Prometheus           | 9090  | http://localhost:9090        |
| Grafana              | 3000  | http://localhost:3000        |

---

## RAM Budget (32GB machine)

| Layer          | Services                              | RAM Limit |
|----------------|---------------------------------------|-----------|
| Core           | Redpanda + Redis + PostgreSQL         | ~4 GB     |
| Data           | ClickHouse + MinIO + Neo4j            | ~8 GB     |
| Compute        | Flink JM + Flink TM + MLflow          | ~5.5 GB   |
| Orchestration  | Airflow webserver + scheduler         | ~2.5 GB   |
| Monitoring     | Prometheus + Grafana                  | ~1.3 GB   |
| **Total**      |                                       | **~21 GB**|

---

## Project Structure

```
fraud-detection/
├── docker-compose.yml          # All services, profiles, resource limits
├── .env.example                # Environment template
├── Makefile                    # All management commands
├── README.md
├── .gitignore
├── config/
│   ├── prometheus/             # prometheus.yml + alert_rules.yml
│   ├── grafana/                # Datasource + dashboard provisioning
│   ├── redpanda/               # Broker config
│   ├── redis/                  # redis.conf (feature store tuning)
│   ├── neo4j/                  # neo4j.conf + APOC + GDS
│   ├── flink/                  # flink-conf.yaml + log4j
│   └── clickhouse/             # config.xml + users.xml
├── scripts/
│   ├── create_topics.sh        # 17 Kafka topics
│   ├── init_postgres.sql       # Schemas + tables + seed data
│   ├── init_clickhouse.sql     # OLAP tables + materialized views
│   └── init_minio.sh           # 6 buckets
└── dags/                       # Airflow DAGs (Phase 7)
```

---

## Credentials

| Service      | Username      | Password             |
|--------------|---------------|----------------------|
| PostgreSQL   | fraud_admin   | fraud_secret_2024    |
| ClickHouse   | fraud_admin   | fraud_secret_2024    |
| MinIO        | fraud_minio   | fraud_minio_2024     |
| Neo4j        | neo4j         | fraud_neo4j_2024     |
| Airflow      | admin         | fraud_admin_2024     |
| Grafana      | admin         | fraud_grafana_2024   |

> Change all passwords in `.env` before any shared deployment.

---

## Build Phases

| Phase | Name                      | Status   |
|-------|---------------------------|----------|
| 0     | Docker Compose scaffold   | COMPLETE |
| 1     | Synthetic data generator  | Next     |
| 2     | Flink feature engineering | Upcoming |
| 3     | Stage 1 — Fast Risk       | Upcoming |
| 4     | Stage 2 — Deep Intel      | Upcoming |
| 5     | Stage 3 — Decision Engine | Upcoming |
| 6     | Storage + Monitoring      | Upcoming |
| 7     | Feedback + Retraining     | Upcoming |
