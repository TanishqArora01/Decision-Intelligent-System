#!/usr/bin/env bash
# security/validate_secrets.sh — Validate required secrets before deploying.
# Exit 1 if any secret is missing or uses a forbidden default value.
set -euo pipefail

MODE="${1:---env}"
ERRORS=0
RED="\033[31m"; GREEN="\033[32m"; RESET="\033[0m"
ok()   { echo -e "  ${GREEN}✓${RESET}  $*"; }
fail() { echo -e "  ${RED}✗${RESET}  $*"; ERRORS=$((ERRORS+1)); }

# Forbidden default values — never allowed in production
FORBIDDEN=("fraud_secret_2024" "fraud_minio_2024" "fraud_neo4j_2024" "admin2024!" "change-me" "CHANGE_ME" "password" "secret")

# Required secrets with minimum lengths
declare -A REQUIRED=(
  ["POSTGRES_PASSWORD"]="12"
  ["JWT_SECRET"]="32"
  ["MINIO_ROOT_PASSWORD"]="12"
  ["NEO4J_PASSWORD"]="12"
  ["ANON_SALT"]="16"
  ["WEBHOOK_SECRET"]="16"
)

check_value() {
  local name="$1" value="$2" min_len="$3"
  if [[ -z "$value" ]]; then fail "$name is empty"; return; fi
  if [[ ${#value} -lt $min_len ]]; then fail "$name too short (${#value}/${min_len} chars)"; return; fi
  if [[ "${ENVIRONMENT:-development}" == "production" ]]; then
    for f in "${FORBIDDEN[@]}"; do
      if [[ "$value" == "$f" ]]; then fail "$name uses forbidden default value"; return; fi
    done
  fi
  ok "$name (${#value} chars)"
}

echo "=== Secret Validation (mode: $MODE, env: ${ENVIRONMENT:-development}) ==="

if [[ "$MODE" == "--env" ]]; then
  for name in "${!REQUIRED[@]}"; do
    check_value "$name" "${!name:-}" "${REQUIRED[$name]}"
  done

elif [[ "$MODE" == "--docker-secrets" ]]; then
  declare -A FILE_MAP=(
    ["POSTGRES_PASSWORD"]="fraud_postgres_password"
    ["JWT_SECRET"]="fraud_jwt_secret"
    ["MINIO_ROOT_PASSWORD"]="fraud_minio_secret_key"
    ["NEO4J_PASSWORD"]="fraud_neo4j_password"
    ["ANON_SALT"]="fraud_anon_salt"
    ["WEBHOOK_SECRET"]="fraud_webhook_secret"
  )
  for name in "${!FILE_MAP[@]}"; do
    path="/run/secrets/${FILE_MAP[$name]}"
    if [[ -f "$path" ]]; then
      check_value "$name" "$(cat "$path")" "${REQUIRED[$name]}"
    else
      fail "$name — secret file not found: $path"
    fi
  done

elif [[ "$MODE" == "--vault" ]]; then
  VAULT_ADDR="${VAULT_ADDR:-http://vault:8201}"
  if ! curl -sf "$VAULT_ADDR/v1/sys/health" > /dev/null 2>&1; then
    fail "Vault unreachable at $VAULT_ADDR"; exit 1
  fi
  for path in secret/data/fraud/postgres secret/data/fraud/app secret/data/fraud/minio; do
    status=$(curl -sf -H "X-Vault-Token: ${VAULT_TOKEN:-}" "$VAULT_ADDR/v1/$path" -o /dev/null -w "%{http_code}" 2>/dev/null)
    [[ "$status" == "200" ]] && ok "$path" || fail "$path (HTTP $status)"
  done
fi

echo ""
if [[ $ERRORS -eq 0 ]]; then echo -e "${GREEN}All secrets validated.${RESET}"; exit 0
else echo -e "${RED}${ERRORS} error(s). Fix before deploying.${RESET}"; exit 1; fi
