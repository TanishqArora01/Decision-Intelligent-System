"""
app-backend/config_secure.py
Secure config using python-decouple.
Reads secrets from Docker secrets files (/run/secrets/) with env var fallback.

Drop-in replacement for config.py when Docker secrets are available.
Usage: rename this to config.py before building the secure image.

Secret file convention (Docker Swarm / Compose secrets):
  /run/secrets/fraud_postgres_password   → POSTGRES_PASSWORD
  /run/secrets/fraud_jwt_secret          → JWT_SECRET
  /run/secrets/fraud_clickhouse_password → CLICKHOUSE_PASSWORD
  etc.

Falls back to environment variables for local development.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import List


def _secret(name: str, env_var: str, default: str = "") -> str:
    """
    Read a value from Docker secrets file first, fall back to env var.
    Secret file path: /run/secrets/{name}
    """
    secret_path = f"/run/secrets/{name}"
    if os.path.exists(secret_path):
        with open(secret_path) as f:
            return f.read().strip()
    return os.getenv(env_var, default)


@dataclass
class AppConfig:
    host:  str = os.getenv("HOST", "0.0.0.0")
    port:  int = int(os.getenv("PORT", "8400"))
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"

    @property
    def postgres_dsn(self) -> str:
        password = _secret("fraud_postgres_password", "POSTGRES_PASSWORD", "fraud_secret_2024")
        host     = os.getenv("POSTGRES_HOST", "postgres")
        user     = os.getenv("POSTGRES_USER", "fraud_admin")
        db       = os.getenv("POSTGRES_DB",   "fraud_db")
        return f"postgresql+asyncpg://{user}:{password}@{host}:5432/{db}"

    clickhouse_host:     str = os.getenv("CLICKHOUSE_HOST", "clickhouse")
    clickhouse_port:     int = int(os.getenv("CLICKHOUSE_PORT", "9000"))
    clickhouse_user:     str = os.getenv("CLICKHOUSE_USER", "fraud_admin")

    @property
    def clickhouse_password(self) -> str:
        return _secret("fraud_clickhouse_password", "CLICKHOUSE_PASSWORD", "fraud_secret_2024")

    clickhouse_db:       str = os.getenv("CLICKHOUSE_DB", "fraud_analytics")
    gateway_url:         str = os.getenv("GATEWAY_URL", "http://api-gateway:8000")

    @property
    def jwt_secret(self) -> str:
        return _secret("fraud_jwt_secret", "JWT_SECRET", "change-me-in-production-fraud2024!")

    jwt_algorithm:              str = os.getenv("JWT_ALGORITHM", "HS256")
    jwt_expire_minutes:         int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
    jwt_refresh_expire_minutes: int = int(os.getenv("JWT_REFRESH_EXPIRE_MINUTES", "10080"))

    cors_origins: List[str] = field(default_factory=lambda: [
        o.strip() for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3001,http://frontend:3001,https://localhost"
        ).split(",")
    ])

    sse_keepalive_seconds: int = int(os.getenv("SSE_KEEPALIVE", "15"))
    sse_max_events:        int = int(os.getenv("SSE_MAX_EVENTS", "500"))
    seed_admin_user:       str = os.getenv("SEED_ADMIN_USER", "admin")

    @property
    def seed_admin_pass(self) -> str:
        return _secret("fraud_seed_admin_password", "SEED_ADMIN_PASSWORD", "admin2024!")

    log_level: str = os.getenv("LOG_LEVEL", "INFO")


config = AppConfig()
