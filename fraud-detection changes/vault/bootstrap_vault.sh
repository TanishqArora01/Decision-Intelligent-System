#!/usr/bin/env bash
# vault/bootstrap_vault.sh
# Bootstrap HashiCorp Vault dev mode with all fraud system secrets.
#
# In production replace dev mode with:
#   vault server -config=/vault/config/vault.hcl  (HA + TLS + auto-unseal)
#
# Usage (run after `make up-vault`):
#   chmod +x vault/bootstrap_vault.sh
#   ./vault/bootstrap_vault.sh

set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-http://localhost:8201}"
VAULT_TOKEN="${VAULT_TOKEN:-fraud-dev-root-token}"

GREEN="\033[32m"; AMBER="\033[33m"; RESET="\033[0m"
ok()   { echo -e "  ${GREEN}OK${RESET}  $*"; }
warn() { echo -e "  ${AMBER}WARN${RESET} $*"; }

echo "=== Vault Bootstrap ==="
echo "Vault address: $VAULT_ADDR"

# Wait for Vault to be ready
for i in {1..30}; do
    if curl -sf "$VAULT_ADDR/v1/sys/health" > /dev/null 2>&1; then
        ok "Vault is ready"
        break
    fi
    echo "  Waiting for Vault... ($i/30)"
    sleep 2
done

export VAULT_ADDR VAULT_TOKEN

# Enable KV-v2 secrets engine at /secret
vault secrets enable -path=secret kv-v2 2>/dev/null || warn "KV already enabled"

# ---------------------------------------------------------------------------
# Write all fraud system secrets
# ---------------------------------------------------------------------------

vault kv put secret/fraud/postgres \
    password="${POSTGRES_PASSWORD:-fraud_secret_2024}" \
    user="${POSTGRES_USER:-fraud_admin}" \
    host="postgres" \
    port="5432" \
    database="fraud_db"
ok "postgres secrets"

vault kv put secret/fraud/clickhouse \
    password="${CLICKHOUSE_PASSWORD:-fraud_secret_2024}" \
    user="${CLICKHOUSE_USER:-fraud_admin}" \
    host="clickhouse" \
    port="9000"
ok "clickhouse secrets"

vault kv put secret/fraud/minio \
    access_key="${MINIO_ROOT_USER:-fraud_minio}" \
    secret_key="${MINIO_ROOT_PASSWORD:-fraud_minio_2024}" \
    endpoint="http://minio:9000"
ok "minio secrets"

vault kv put secret/fraud/neo4j \
    password="${NEO4J_PASSWORD:-fraud_neo4j_2024}" \
    user="neo4j" \
    uri="bolt://neo4j:7687"
ok "neo4j secrets"

vault kv put secret/fraud/app \
    jwt_secret="${JWT_SECRET:-change-me-in-production-fraud2024!}" \
    anon_salt="${ANON_SALT:-fraud-anon-salt-2024}" \
    webhook_secret="${WEBHOOK_SECRET:-webhook-secret-2024}"
ok "app secrets (JWT + anon salt)"

vault kv put secret/fraud/mlflow \
    tracking_password="${MLFLOW_TRACKING_PASSWORD:-mlflow2024}"
ok "mlflow secrets"

vault kv put secret/fraud/airflow \
    secret_key="${AIRFLOW_SECRET_KEY:-airflow_secret_2024}" \
    fernet_key="${AIRFLOW_FERNET_KEY:-airflow_fernet_2024}"
ok "airflow secrets"

# ---------------------------------------------------------------------------
# Create a read-only policy for application services
# ---------------------------------------------------------------------------
vault policy write fraud-app-policy - << 'POLICY'
path "secret/data/fraud/*" {
  capabilities = ["read", "list"]
}
path "secret/metadata/fraud/*" {
  capabilities = ["list"]
}
POLICY
ok "fraud-app-policy created"

# Create an AppRole for the fraud services
vault auth enable approle 2>/dev/null || warn "AppRole already enabled"

vault write auth/approle/role/fraud-services \
    token_policies="fraud-app-policy" \
    token_ttl="1h" \
    token_max_ttl="4h" \
    secret_id_ttl="24h"
ok "AppRole 'fraud-services' created"

# Get role_id and secret_id for services to use
ROLE_ID=$(vault read -field=role_id auth/approle/role/fraud-services/role-id)
SECRET_ID=$(vault write -f -field=secret_id auth/approle/role/fraud-services/secret-id)

echo ""
echo "=== AppRole Credentials (save these) ==="
echo "  VAULT_ROLE_ID=${ROLE_ID}"
echo "  VAULT_SECRET_ID=${SECRET_ID}"
echo ""
echo "  Add to .env:"
echo "  VAULT_ROLE_ID=${ROLE_ID}"
echo "  VAULT_SECRET_ID=${SECRET_ID}"
echo "  VAULT_ADDR=${VAULT_ADDR}"
echo ""
echo "=== Vault Bootstrap Complete ==="
