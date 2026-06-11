#!/usr/bin/env bash
# scripts/ci/test.sh — Run all automated tests.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ERRORS=0
SUITE="${TEST_SUITE:-all}"

ok()   { echo "  ✓  $*"; }
fail() { echo "  ✗  $*"; ERRORS=$((ERRORS+1)); }
skip() { echo "  –  $* (skipped)"; }

echo "=== Tests (suite: $SUITE) ==="
echo ""

# ── Pytest unit tests ─────────────────────────────────────────────────────────
if [[ "$SUITE" == "all" || "$SUITE" == "unit" ]]; then
    echo "Unit tests — pytest"
    if command -v pytest &>/dev/null; then
        if pytest "$ROOT" \
            --ignore="$ROOT/frontend" \
            --ignore="$ROOT/node_modules" \
            --ignore="$ROOT/deploy" \
            -q --tb=short \
            -m "not integration" \
            2>&1; then
            ok "pytest unit tests passed"
        else
            fail "pytest unit tests failed"
        fi
    else
        skip "pytest not installed"
    fi
fi

# ── Offline integration tests ─────────────────────────────────────────────────
if [[ "$SUITE" == "all" || "$SUITE" == "integration" ]]; then
    echo ""
    echo "Integration tests — offline suites (no services required)"
    if [[ -f "$ROOT/scripts/integration_test.py" ]]; then
        for suite in contracts fallback; do
            if python3 "$ROOT/scripts/integration_test.py" --suite "$suite" 2>&1; then
                ok "integration suite: $suite"
            else
                fail "integration suite: $suite"
            fi
        done
    else
        skip "integration_test.py not found"
    fi
fi

# ── Kafka contract validation ─────────────────────────────────────────────────
if [[ "$SUITE" == "all" || "$SUITE" == "contracts" ]]; then
    echo ""
    echo "Kafka data contracts"
    if [[ -f "$ROOT/contracts/kafka_contracts.py" ]]; then
        if python3 -c "
import sys
sys.path.insert(0, '$ROOT/contracts')
from kafka_contracts import TOPIC_SCHEMAS, validate_message, TransactionRawMessage
assert len(TOPIC_SCHEMAS) == 7, f'Expected 7 schemas, got {len(TOPIC_SCHEMAS)}'
txn = TransactionRawMessage(txn_id='t1', customer_id='c1', amount=100.0)
_, ok, err = validate_message('txn-raw', txn.to_kafka_bytes())
assert ok, f'Validation failed: {err}'
print('7 topic schemas OK, round-trip validation OK')
" 2>&1; then
            ok "Kafka contracts valid"
        else
            fail "Kafka contracts invalid"
        fi
    else
        skip "kafka_contracts.py not found"
    fi
fi

echo ""
echo "─────────────────────────────"
if [[ $ERRORS -eq 0 ]]; then
    echo "✓ All tests passed"
    exit 0
else
    echo "✗ $ERRORS test suite(s) failed"
    exit 1
fi
