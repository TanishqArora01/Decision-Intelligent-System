#!/usr/bin/env bash
# scripts/ci/compose_validate.sh — Validate docker-compose syntax and structure.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ERRORS=0

ok()   { echo "  ✓  $*"; }
fail() { echo "  ✗  $*"; ERRORS=$((ERRORS+1)); }

echo "=== Docker Compose Validation ==="
echo ""

COMPOSE_FILE="$ROOT/docker-compose.yml"

# ── YAML syntax ───────────────────────────────────────────────────────────────
echo "YAML syntax"
if python3 -c "
import yaml, sys
with open('$COMPOSE_FILE') as f:
    doc = yaml.safe_load(f)
services = list(doc.get('services', {}).keys())
print(f'  Parsed OK — {len(services)} services: {services[:5]}...')
" 2>&1; then
    ok "YAML parses cleanly"
else
    fail "YAML syntax error"
fi

# ── docker compose config (requires Docker) ───────────────────────────────────
echo ""
echo "docker compose config"
if command -v docker &>/dev/null; then
    if docker compose -f "$COMPOSE_FILE" config --quiet 2>&1; then
        ok "docker compose config valid"
    else
        fail "docker compose config failed"
    fi
else
    echo "  –  docker not available — skipping compose config check"
fi

# ── Required services present ─────────────────────────────────────────────────
echo ""
echo "Required services present"
REQUIRED=(
    redpanda redis postgres clickhouse minio neo4j
    stage1-service stage2-service stage3-service
    api-gateway app-backend frontend
    decision-sink feedback-service mlops-service webhook-adapter
    prometheus grafana airflow-webserver vault
)
python3 << PYEOF
import yaml
with open('$COMPOSE_FILE') as f:
    doc = yaml.safe_load(f)
services = set(doc.get('services', {}).keys())
required = $(python3 -c "print(repr(['redpanda','redis','postgres','clickhouse','minio','neo4j','stage1-service','stage2-service','stage3-service','api-gateway','app-backend','frontend','decision-sink','feedback-service','mlops-service','webhook-adapter','prometheus','grafana','vault']))")
missing = [s for s in required if s not in services]
if missing:
    print(f'MISSING: {missing}')
    exit(1)
else:
    print(f'All {len(required)} required services present ({len(services)} total)')
PYEOF
if [[ $? -eq 0 ]]; then
    ok "all required services present"
else
    fail "missing required services"
fi

# ── No hardcoded secrets ───────────────────────────────────────────────────────
echo ""
echo "No hardcoded secrets in compose file"
FORBIDDEN_SECRETS=(
    "fraud_secret_2024"
    "fraud_minio_2024"
    "fraud_neo4j_2024"
    "admin2024!"
    "change-me-in-production"
    "password123"
)
SECRET_FOUND=0
for secret in "${FORBIDDEN_SECRETS[@]}"; do
    if grep -q "$secret" "$COMPOSE_FILE" 2>/dev/null; then
        fail "hardcoded secret found: '$secret'"
        SECRET_FOUND=1
    fi
done
if [[ $SECRET_FOUND -eq 0 ]]; then
    ok "no hardcoded secrets detected"
fi

# ── All services have resource limits ─────────────────────────────────────────
echo ""
echo "Services have resource limits"
MISSING_LIMITS=$(python3 << 'PYEOF'
import yaml
with open('$COMPOSE_FILE') as f:
    doc = yaml.safe_load(f)
missing = []
for name, svc in doc.get('services', {}).items():
    if not svc.get('deploy', {}).get('resources', {}).get('limits'):
        if name not in ('redpanda-init', 'minio-init', 'airflow-init'):
            missing.append(name)
if missing:
    print(' '.join(missing))
PYEOF
)
if [[ -z "$MISSING_LIMITS" ]]; then
    ok "all services have resource limits"
else
    echo "  ~  services missing limits (warning): $MISSING_LIMITS"
fi

# ── Overlay files valid ────────────────────────────────────────────────────────
echo ""
echo "Compose overlay files"
for overlay in "$ROOT/deploy/compose"/*.yml; do
    [[ -f "$overlay" ]] || continue
    name=$(basename "$overlay")
    if python3 -c "import yaml; yaml.safe_load(open('$overlay'))" 2>/dev/null; then
        ok "overlay: $name"
    else
        fail "overlay invalid: $name"
    fi
done

echo ""
echo "─────────────────────────────"
if [[ $ERRORS -eq 0 ]]; then
    echo "✓ Compose validation passed"
    exit 0
else
    echo "✗ $ERRORS validation check(s) failed"
    exit 1
fi
