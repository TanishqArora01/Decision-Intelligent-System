# =============================================================================
# Fraud Detection System — Makefile
# All commands you need to operate the system layer by layer
# =============================================================================

COMPOSE = docker compose
ENV_FILE = .env
COMPOSE_FILE = docker-compose.yml

# Colour output
GREEN  := \033[0;32m
YELLOW := \033[1;33m
CYAN   := \033[0;36m
RESET  := \033[0m

.DEFAULT_GOAL := help

# =============================================================================
# HELP
# =============================================================================

.PHONY: help
help:
	@echo ""
	@echo "$(CYAN)Fraud Detection System — Command Reference$(RESET)"
	@echo "============================================"
	@echo ""
	@echo "$(YELLOW)Layer-by-layer startup (recommended order):$(RESET)"
	@echo "  make setup            — copy .env.example to .env, create dirs"
	@echo "  make up-core          — start Redpanda + Redis + PostgreSQL"
	@echo "  make up-data          — start ClickHouse + MinIO + Neo4j"
	@echo "  make up-compute       — start Flink + MLflow"
	@echo "  make up-orchestrate   — start Airflow (webserver + scheduler)"
	@echo "  make up-monitoring    — start Prometheus + Grafana"
	@echo ""
	@echo "$(YELLOW)Full stack:$(RESET)"
	@echo "  make up-all           — start everything at once"
	@echo "  make down             — stop all running services"
	@echo "  make down-all         — stop + remove containers (keep volumes)"
	@echo "  make clean            — stop + remove containers AND volumes (DESTRUCTIVE)"
	@echo ""
	@echo "$(YELLOW)Operations:$(RESET)"
	@echo "  make status           — show running containers + health"
	@echo "  make logs             — tail logs for all services"
	@echo "  make logs-core        — tail core layer logs only"
	@echo "  make ps               — docker compose ps"
	@echo "  make pull             — pull latest images"
	@echo ""
	@echo "$(YELLOW)Service-specific:$(RESET)"
	@echo "  make logs SERVICE=fraud_redpanda    — tail a specific container"
	@echo "  make shell SERVICE=fraud_postgres   — open shell in container"
	@echo "  make restart SERVICE=fraud_redis    — restart a specific service"
	@echo ""
	@echo "$(YELLOW)Validation:$(RESET)"
	@echo "  make validate-core    — test Redpanda + Redis + Postgres connectivity"
	@echo "  make validate-data    — test ClickHouse + MinIO + Neo4j connectivity"
	@echo "  make validate-all     — run all validation checks"
	@echo "  make ports            — show all exposed ports"
	@echo ""

# =============================================================================
# SETUP
# =============================================================================

.PHONY: setup
setup:
	@echo "$(GREEN)Setting up project...$(RESET)"
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(YELLOW)Created .env from .env.example — review and adjust before first run$(RESET)"; \
	else \
		echo ".env already exists, skipping"; \
	fi
	@mkdir -p dags plugins
	@echo "$(GREEN)Setup complete. Run 'make up-core' to start the core layer.$(RESET)"

# =============================================================================
# LAYER-BY-LAYER STARTUP
# =============================================================================

.PHONY: up-core
up-core:
	@echo "$(GREEN)Starting CORE layer: Redpanda + Redis + PostgreSQL...$(RESET)"
	$(COMPOSE) --env-file $(ENV_FILE) --profile core up -d
	@echo ""
	@echo "$(CYAN)Core layer services:$(RESET)"
	@echo "  Redpanda Kafka API:      localhost:9092"
	@echo "  Redpanda Admin API:      localhost:9644"
	@echo "  Redpanda Schema Reg:     localhost:8081"
	@echo "  Redis:                   localhost:6379"
	@echo "  PostgreSQL:              localhost:5432"
	@echo ""
	@echo "$(YELLOW)Waiting for health checks... (up to 60s)$(RESET)"
	@sleep 5
	@$(COMPOSE) ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || $(COMPOSE) ps
	@echo ""
	@echo "$(GREEN)Next step: make up-data$(RESET)"

.PHONY: up-data
up-data:
	@echo "$(GREEN)Starting DATA layer: ClickHouse + MinIO + Neo4j...$(RESET)"
	$(COMPOSE) --env-file $(ENV_FILE) --profile data up -d
	@echo ""
	@echo "$(CYAN)Data layer services:$(RESET)"
	@echo "  ClickHouse HTTP:         localhost:8123"
	@echo "  ClickHouse Native:       localhost:9000"
	@echo "  MinIO S3 API:            localhost:9001"
	@echo "  MinIO Console:           localhost:9002"
	@echo "  Neo4j Browser:           localhost:7474"
	@echo "  Neo4j Bolt:              localhost:7687"
	@echo ""
	@echo "$(YELLOW)Neo4j takes ~60s to fully start — be patient$(RESET)"
	@echo ""
	@echo "$(GREEN)Next step: make up-compute$(RESET)"

.PHONY: up-compute
up-compute:
	@echo "$(GREEN)Starting COMPUTE layer: Flink + MLflow...$(RESET)"
	$(COMPOSE) --env-file $(ENV_FILE) --profile compute up -d
	@echo ""
	@echo "$(CYAN)Compute layer services:$(RESET)"
	@echo "  Flink Web UI:            localhost:8083"
	@echo "  MLflow UI:               localhost:5000"
	@echo ""
	@echo "$(GREEN)Next step: make up-orchestrate$(RESET)"

.PHONY: up-orchestrate
up-orchestrate:
	@echo "$(GREEN)Starting ORCHESTRATION layer: Airflow...$(RESET)"
	$(COMPOSE) --env-file $(ENV_FILE) --profile orchestration up -d
	@echo ""
	@echo "$(CYAN)Orchestration layer services:$(RESET)"
	@echo "  Airflow UI:              localhost:8080"
	@echo "  Default login:           admin / fraud_admin_2024"
	@echo ""
	@echo "$(YELLOW)Airflow init takes ~90s on first run — DB migration in progress$(RESET)"
	@echo ""
	@echo "$(GREEN)Next step: make up-monitoring$(RESET)"

.PHONY: up-monitoring
up-monitoring:
	@echo "$(GREEN)Starting MONITORING layer: Prometheus + Grafana...$(RESET)"
	$(COMPOSE) --env-file $(ENV_FILE) --profile monitoring up -d
	@echo ""
	@echo "$(CYAN)Monitoring layer services:$(RESET)"
	@echo "  Prometheus:              localhost:9090"
	@echo "  Grafana:                 localhost:3000"
	@echo "  Grafana login:           admin / fraud_grafana_2024"
	@echo ""
	@echo "$(GREEN)All layers started. Run 'make status' to verify.$(RESET)"

.PHONY: up-all
up-all:
	@echo "$(GREEN)Starting ALL layers simultaneously...$(RESET)"
	$(COMPOSE) --env-file $(ENV_FILE) --profile full up -d
	@echo ""
	@echo "$(YELLOW)Full stack starting — allow 2-3 minutes for all health checks$(RESET)"
	@sleep 10
	@make status

# =============================================================================
# TEARDOWN
# =============================================================================

.PHONY: down
down:
	@echo "$(YELLOW)Stopping all services (volumes preserved)...$(RESET)"
	$(COMPOSE) --profile full --profile core --profile data --profile compute --profile orchestration --profile monitoring stop

.PHONY: down-all
down-all:
	@echo "$(YELLOW)Stopping and removing containers (volumes preserved)...$(RESET)"
	$(COMPOSE) --profile full --profile core --profile data --profile compute --profile orchestration --profile monitoring down

.PHONY: clean
clean:
	@echo "$(YELLOW)WARNING: This will delete ALL data volumes. Are you sure? [y/N]$(RESET)"
	@read -r ans && [ "$$ans" = "y" ] || (echo "Aborted." && exit 1)
	$(COMPOSE) --profile full --profile core --profile data --profile compute --profile orchestration --profile monitoring down -v
	@echo "$(GREEN)All containers and volumes removed.$(RESET)"

# =============================================================================
# STATUS & OBSERVABILITY
# =============================================================================

.PHONY: status
status:
	@echo "$(CYAN)=== Service Status ===$(RESET)"
	@$(COMPOSE) ps --format "table {{.Name}}\t{{.Service}}\t{{.Status}}\t{{.Health}}" 2>/dev/null || $(COMPOSE) ps
	@echo ""

.PHONY: ps
ps:
	$(COMPOSE) ps

.PHONY: logs
logs:
	$(COMPOSE) logs -f --tail=100

.PHONY: logs-core
logs-core:
	$(COMPOSE) logs -f --tail=50 redpanda redis postgres

.PHONY: logs-data
logs-data:
	$(COMPOSE) logs -f --tail=50 clickhouse minio neo4j

.PHONY: logs-compute
logs-compute:
	$(COMPOSE) logs -f --tail=50 flink-jobmanager flink-taskmanager mlflow

.PHONY: logs-monitoring
logs-monitoring:
	$(COMPOSE) logs -f --tail=50 prometheus grafana

logs:
ifdef SERVICE
	docker logs -f $(SERVICE) --tail=100
else
	$(COMPOSE) logs -f --tail=50
endif

.PHONY: shell
shell:
ifdef SERVICE
	docker exec -it $(SERVICE) /bin/sh || docker exec -it $(SERVICE) /bin/bash
else
	@echo "Usage: make shell SERVICE=fraud_postgres"
endif

.PHONY: restart
restart:
ifdef SERVICE
	$(COMPOSE) restart $(SERVICE)
else
	@echo "Usage: make restart SERVICE=fraud_redis"
endif

# =============================================================================
# IMAGE MANAGEMENT
# =============================================================================

.PHONY: pull
pull:
	@echo "$(GREEN)Pulling latest images...$(RESET)"
	$(COMPOSE) --profile full pull

# =============================================================================
# VALIDATION — connectivity tests
# =============================================================================

.PHONY: validate-core
validate-core:
	@echo "$(CYAN)Validating core layer...$(RESET)"
	@echo -n "  PostgreSQL: "
	@docker exec fraud_postgres pg_isready -U fraud_admin -d fraud_db 2>/dev/null && echo "$(GREEN)OK$(RESET)" || echo "$(YELLOW)NOT READY$(RESET)"
	@echo -n "  Redis: "
	@docker exec fraud_redis redis-cli ping 2>/dev/null | grep -q PONG && echo "$(GREEN)OK$(RESET)" || echo "$(YELLOW)NOT READY$(RESET)"
	@echo -n "  Redpanda (Kafka): "
	@docker exec fraud_redpanda rpk cluster health 2>/dev/null | grep -q "Healthy:.* true" && echo "$(GREEN)OK$(RESET)" || echo "$(YELLOW)NOT READY$(RESET)"
	@echo -n "  Redpanda (topics): "
	@docker exec fraud_redpanda rpk topic list 2>/dev/null && echo "$(GREEN)Topics listed$(RESET)" || echo "$(YELLOW)NOT READY$(RESET)"

.PHONY: validate-data
validate-data:
	@echo "$(CYAN)Validating data layer...$(RESET)"
	@echo -n "  ClickHouse: "
	@curl -sf http://localhost:8123/ping 2>/dev/null && echo "$(GREEN)OK$(RESET)" || echo "$(YELLOW)NOT READY$(RESET)"
	@echo -n "  MinIO: "
	@curl -sf http://localhost:9001/minio/health/live 2>/dev/null && echo "$(GREEN)OK$(RESET)" || echo "$(YELLOW)NOT READY$(RESET)"
	@echo -n "  Neo4j: "
	@curl -sf http://localhost:7474 2>/dev/null | grep -q "neo4j" && echo "$(GREEN)OK$(RESET)" || echo "$(YELLOW)NOT READY$(RESET)"

.PHONY: validate-compute
validate-compute:
	@echo "$(CYAN)Validating compute layer...$(RESET)"
	@echo -n "  Flink JobManager: "
	@curl -sf http://localhost:8083/overview 2>/dev/null | grep -q "flink" && echo "$(GREEN)OK$(RESET)" || echo "$(YELLOW)NOT READY$(RESET)"
	@echo -n "  MLflow: "
	@curl -sf http://localhost:5000/health 2>/dev/null && echo "$(GREEN)OK$(RESET)" || echo "$(YELLOW)NOT READY$(RESET)"

.PHONY: validate-all
validate-all: validate-core validate-data validate-compute
	@echo ""
	@echo "$(CYAN)Validating monitoring layer...$(RESET)"
	@echo -n "  Prometheus: "
	@curl -sf http://localhost:9090/-/healthy 2>/dev/null && echo "$(GREEN)OK$(RESET)" || echo "$(YELLOW)NOT READY$(RESET)"
	@echo -n "  Grafana: "
	@curl -sf http://localhost:3000/api/health 2>/dev/null | grep -q "ok" && echo "$(GREEN)OK$(RESET)" || echo "$(YELLOW)NOT READY$(RESET)"

# =============================================================================
# UTILITY
# =============================================================================

.PHONY: ports
ports:
	@echo "$(CYAN)=== Service Port Map ===$(RESET)"
	@echo ""
	@echo "CORE LAYER"
	@echo "  Redpanda Kafka:          localhost:9092"
	@echo "  Redpanda Admin API:      localhost:9644"
	@echo "  Redpanda Schema Reg:     localhost:8081"
	@echo "  Redpanda HTTP Proxy:     localhost:8082"
	@echo "  Redis:                   localhost:6379"
	@echo "  PostgreSQL:              localhost:5432"
	@echo ""
	@echo "DATA LAYER"
	@echo "  ClickHouse HTTP:         localhost:8123"
	@echo "  ClickHouse Native:       localhost:9000"
	@echo "  MinIO S3 API:            localhost:9001"
	@echo "  MinIO Console UI:        localhost:9002"
	@echo "  Neo4j Browser:           localhost:7474"
	@echo "  Neo4j Bolt:              localhost:7687"
	@echo ""
	@echo "COMPUTE LAYER"
	@echo "  Flink Web UI:            localhost:8083"
	@echo "  MLflow Tracking UI:      localhost:5000"
	@echo ""
	@echo "ORCHESTRATION LAYER"
	@echo "  Airflow UI:              localhost:8080"
	@echo ""
	@echo "MONITORING LAYER"
	@echo "  Prometheus:              localhost:9090"
	@echo "  Grafana:                 localhost:3000"
	@echo ""
	@echo "APP MICROSERVICES (Phase 3+)"
	@echo "  API Gateway:             localhost:8000"
	@echo "  Stage 1 (Fast Risk):     localhost:8100"
	@echo "  Stage 2 (Deep Intel):    localhost:8200"
	@echo "  Stage 3 (Decision Eng):  localhost:8300"
	@echo "  Action Engine:           localhost:8400"
	@echo ""

.PHONY: topics
topics:
	@echo "$(CYAN)Redpanda / Kafka Topics:$(RESET)"
	@docker exec fraud_redpanda rpk topic list

.PHONY: topic-describe
topic-describe:
ifdef TOPIC
	docker exec fraud_redpanda rpk topic describe $(TOPIC)
else
	@echo "Usage: make topic-describe TOPIC=txn-raw"
endif

# =============================================================================
# GENERATOR — Phase 1
# =============================================================================

.PHONY: up-generator
up-generator:
	@echo "$(GREEN)Starting GENERATOR — Synthetic transaction producer...$(RESET)"
	$(COMPOSE) --env-file $(ENV_FILE) --profile generator up -d --build
	@echo ""
	@echo "$(CYAN)Generator endpoints:$(RESET)"
	@echo "  Prometheus metrics:  http://localhost:9101/metrics"
	@echo ""
	@echo "$(YELLOW)Runtime overrides (set before command):$(RESET)"
	@echo "  GENERATOR_TPS=1000 make up-generator"
	@echo "  FRAUD_RATE=0.10    make up-generator"

.PHONY: generator-logs
generator-logs:
	docker logs -f fraud_generator --tail=100

.PHONY: generator-stop
generator-stop:
	$(COMPOSE) stop generator

.PHONY: generator-metrics
generator-metrics:
	@curl -s http://localhost:9101/metrics 2>/dev/null | grep "^generator_" || echo "Generator not running"

.PHONY: generator-tps
generator-tps:
ifdef TPS
	GENERATOR_TPS=$(TPS) $(COMPOSE) --env-file $(ENV_FILE) --profile generator up -d generator
else
	@echo "Usage: make generator-tps TPS=1000"
endif

.PHONY: consume-raw
consume-raw:
	@echo "$(CYAN)Consuming 5 messages from txn-raw:$(RESET)"
	docker exec fraud_redpanda rpk topic consume txn-raw --brokers redpanda:9092 -n 5

.PHONY: topic-stats
topic-stats:
	@echo "$(CYAN)Topic stats — txn-raw:$(RESET)"
	docker exec fraud_redpanda rpk topic describe txn-raw --brokers redpanda:9092

# =============================================================================
# FEATURE ENGINE — Phase 2
# =============================================================================

.PHONY: up-feature-engine
up-feature-engine:
	@echo "$(GREEN)Starting FEATURE ENGINE...$(RESET)"
	$(COMPOSE) --env-file $(ENV_FILE) --profile feature-engine up -d --build
	@echo ""
	@echo "$(CYAN)Feature engine:$(RESET)"
	@echo "  Input:    txn-raw (Kafka)"
	@echo "  Output:   txn-enriched (Kafka) + Redis (online) + MinIO (offline)"
	@echo "  Metrics:  http://localhost:9102/metrics"
	@echo "  Features: 18 across velocity/geo/device/behavioral groups"

.PHONY: feature-engine-logs
feature-engine-logs:
	docker logs -f fraud_feature_engine --tail=100

.PHONY: feature-engine-metrics
feature-engine-metrics:
	@curl -s http://localhost:9102/metrics 2>/dev/null | grep "^feature_engine_" || echo "Not running"

.PHONY: consume-enriched
consume-enriched:
	@echo "$(CYAN)Consuming 3 enriched transactions from txn-enriched:$(RESET)"
	docker exec fraud_redpanda rpk topic consume txn-enriched --brokers redpanda:9092 -n 3

.PHONY: redis-inspect
redis-inspect:
ifdef CUSTOMER
	@echo "$(CYAN)Redis state for customer $(CUSTOMER):$(RESET)"
	@docker exec fraud_redis redis-cli --scan --pattern "feat:$(CUSTOMER):*" | head -20
else
	@echo "$(CYAN)Redis key count by prefix:$(RESET)"
	@docker exec fraud_redis redis-cli DBSIZE
	@docker exec fraud_redis redis-cli --scan --pattern "feat:*:behavioral" | wc -l | xargs echo "Active customers:"

endif

.PHONY: flink-submit-feature-job
flink-submit-feature-job:
	@echo "$(YELLOW)Submitting PyFlink feature job to Flink cluster...$(RESET)"
	docker cp feature-engine/flink/feature_job.py fraud_flink_jobmanager:/opt/flink/feature_job.py
	docker exec fraud_flink_jobmanager bash -c "cd /opt/flink && pip install redis confluent-kafka -q && flink run -py /opt/flink/feature_job.py"

# =============================================================================
# STAGE 1 — Phase 3
# =============================================================================

.PHONY: up-stage1
up-stage1:
	@echo "$(GREEN)Starting Stage 1 — Fast Risk Estimation...$(RESET)"
	$(COMPOSE) --env-file $(ENV_FILE) --profile stage1 up -d --build
	@echo ""
	@echo "$(CYAN)Stage 1 endpoints:$(RESET)"
	@echo "  REST API:    http://localhost:8100/predict"
	@echo "  Swagger UI:  http://localhost:8100/docs"
	@echo "  Model info:  http://localhost:8100/model-info"
	@echo "  Metrics:     http://localhost:9103/metrics"
	@echo ""
	@echo "$(YELLOW)Note: First startup trains LightGBM (~60s)$(RESET)"

.PHONY: stage1-logs
stage1-logs:
	docker logs -f fraud_stage1 --tail=100

.PHONY: stage1-predict
stage1-predict:
	@echo "$(CYAN)Sending test transaction to Stage 1:$(RESET)"
	@curl -s -X POST http://localhost:8100/predict \
	  -H "Content-Type: application/json" \
	  -d '{"txn_id":"test-001","customer_id":"cust-999","amount":150.0,"country_code":"IN","device_id":"DEV-KNOWN","ip_address":"192.168.1.1","txn_count_1m":1,"txn_count_5m":2,"txn_count_1h":5,"txn_count_24h":12,"amount_sum_1m":150.0,"amount_sum_5m":280.0,"amount_sum_1h":650.0,"amount_sum_24h":1200.0,"geo_velocity_kmh":12.0,"is_new_country":false,"unique_countries_24h":1,"device_trust_score":0.9,"is_new_device":false,"ip_txn_count_1h":3,"unique_devices_24h":1,"amount_vs_avg_ratio":1.2,"merchant_familiarity":0.8,"hours_since_last_txn":6.5,"has_cold_start":false}' \
	  | python3 -m json.tool

.PHONY: stage1-predict-fraud
stage1-predict-fraud:
	@echo "$(CYAN)Sending FRAUD test transaction to Stage 1 (card testing pattern):$(RESET)"
	@curl -s -X POST http://localhost:8100/predict \
	  -H "Content-Type: application/json" \
	  -d '{"txn_id":"fraud-001","customer_id":"cust-evil","amount":2.99,"country_code":"RO","device_id":"DEV-NEW-UNKNOWN","ip_address":"185.220.101.1","txn_count_1m":12,"txn_count_5m":12,"txn_count_1h":12,"txn_count_24h":14,"amount_sum_1m":35.0,"amount_sum_5m":35.0,"amount_sum_1h":35.0,"amount_sum_24h":42.0,"geo_velocity_kmh":9500.0,"is_new_country":true,"unique_countries_24h":3,"device_trust_score":0.0,"is_new_device":true,"ip_txn_count_1h":85,"unique_devices_24h":1,"amount_vs_avg_ratio":0.04,"merchant_familiarity":0.0,"hours_since_last_txn":0.05,"has_cold_start":false}' \
	  | python3 -m json.tool

.PHONY: stage1-model-info
stage1-model-info:
	@curl -s http://localhost:8100/model-info | python3 -m json.tool

.PHONY: stage1-metrics
stage1-metrics:
	@curl -s http://localhost:9103/metrics 2>/dev/null | grep "^stage1_" || echo "Stage 1 not running"
