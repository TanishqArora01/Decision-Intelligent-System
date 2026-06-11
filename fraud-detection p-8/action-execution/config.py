from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class ActionEngineConfig:
    service_name: str = "action-engine"
    service_version: str = "1.0.0"
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8400"))
    metrics_port: int = int(os.getenv("METRICS_PORT", "9106"))

    kafka_bootstrap_servers: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    kafka_topic_decisions: str = os.getenv("KAFKA_TOPIC_DECISIONS", "decisions")
    kafka_consumer_group: str = os.getenv("KAFKA_CONSUMER_GROUP", "action-engine-v1")
    kafka_auto_offset_reset: str = os.getenv("KAFKA_AUTO_OFFSET_RESET", "earliest")
    kafka_enabled: bool = os.getenv("KAFKA_ENABLED", "true").lower() == "true"

    kafka_topic_approve: str = os.getenv("KAFKA_TOPIC_APPROVE", "action-approve")
    kafka_topic_block: str = os.getenv("KAFKA_TOPIC_BLOCK", "action-block")
    kafka_topic_stepup: str = os.getenv("KAFKA_TOPIC_STEPUP", "action-stepup")
    kafka_topic_review: str = os.getenv("KAFKA_TOPIC_REVIEW", "action-review")
    kafka_topic_label: str = os.getenv("KAFKA_TOPIC_LABELS", "fraud-labels")

    postgres_dsn: str = os.getenv(
        "POSTGRES_DSN",
        "postgresql://fraud_admin:fraud_secret_2024@postgres:5432/fraud_db",
    )
    postgres_enabled: bool = os.getenv("PG_ENABLED", "true").lower() == "true"
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    review_queue_limit: int = int(os.getenv("REVIEW_QUEUE_LIMIT", "5000"))


config = ActionEngineConfig()
