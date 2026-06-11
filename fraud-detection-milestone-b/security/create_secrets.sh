#!/usr/bin/env bash
# security/create_secrets.sh
# Creates Docker secrets from .env file values.
# Run once before `make up-all` in a Docker Swarm or as named secrets for Compose.
#
# Usage:
#   chmod +x security/create_secrets.sh
#   ./security/create_secrets.sh [--env-file .env]

set -euo pipefail

ENV_FILE="${1:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Run: cp .env.example .env"
  exit 1
fi

# Load env file
set -a; source "$ENV_FILE"; set +a

echo "Creating Docker secrets from $ENV_FILE..."

# Helper: create secret if it doesn't already exist
create_secret() {
  local name="$1"
  local value="$2"
  if docker secret ls --format '{{.Name}}' | grep -q "^${name}$"; then
    echo "  SKIP  $name (already exists)"
  else
    echo -n "$value" | docker secret create "$name" -
    echo "  OK    $name"
  fi
}

create_secret "fraud_postgres_password"   "${POSTGRES_PASSWORD:-fraud_secret_2024}"
create_secret "fraud_clickhouse_password" "${CLICKHOUSE_PASSWORD:-fraud_secret_2024}"
create_secret "fraud_minio_secret_key"    "${MINIO_ROOT_PASSWORD:-fraud_minio_2024}"
create_secret "fraud_neo4j_password"      "${NEO4J_PASSWORD:-fraud_neo4j_2024}"
create_secret "fraud_jwt_secret"          "${JWT_SECRET:-change-me-in-production-fraud2024!}"
create_secret "fraud_mlflow_secret"       "${MLFLOW_TRACKING_PASSWORD:-mlflow2024}"
create_secret "fraud_airflow_secret"      "${AIRFLOW_SECRET_KEY:-airflow_secret_2024}"
create_secret "fraud_anon_salt"           "${ANON_SALT:-fraud-anon-salt-2024}"

echo ""
echo "Secrets created. Update docker-compose.yml services to use:"
echo "  secrets:"
echo "    - fraud_postgres_password"
echo "  environment:"
echo "    POSTGRES_PASSWORD_FILE: /run/secrets/fraud_postgres_password"
