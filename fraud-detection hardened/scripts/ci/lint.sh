#!/usr/bin/env bash
# scripts/ci/lint.sh — Runs all linters. Exit 1 if any fail.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ERRORS=0

ok()   { echo "  ✓  $*"; }
fail() { echo "  ✗  $*"; ERRORS=$((ERRORS+1)); }
skip() { echo "  –  $* (skipped — tool not installed)"; }

echo "=== Lint ==="
echo ""

# ── Python: ruff ─────────────────────────────────────────────────────────────
echo "Python — ruff"
if command -v ruff &>/dev/null; then
    if ruff check "$ROOT" \
        --exclude ".git,__pycache__,node_modules,.next,*.egg-info" \
        --select E,F,W,I \
        --ignore E501 \
        --output-format=concise 2>&1; then
        ok "ruff passed"
    else
        fail "ruff found issues"
    fi
else
    skip "ruff"
fi

# ── Python: bandit (security linting) ────────────────────────────────────────
echo ""
echo "Python — bandit (security)"
if command -v bandit &>/dev/null; then
    PY_DIRS=()
    for d in "$ROOT"/{app-backend,stage1-service,stage2-service,stage3-service,\
                     feature-engine,feedback-service,mlops-service,\
                     transaction-adapters,sinks,generator}; do
        [[ -d "$d" ]] && PY_DIRS+=("$d")
    done
    if [[ ${#PY_DIRS[@]} -gt 0 ]]; then
        if bandit -r "${PY_DIRS[@]}" \
            --skip B101,B601 \
            --severity-level medium \
            -q 2>&1; then
            ok "bandit passed"
        else
            fail "bandit found security issues"
        fi
    else
        skip "no Python service dirs found"
    fi
else
    skip "bandit"
fi

# ── TypeScript: eslint ────────────────────────────────────────────────────────
echo ""
echo "TypeScript — eslint"
FRONTEND="$ROOT/frontend"
if [[ -d "$FRONTEND" ]] && command -v npx &>/dev/null; then
    if (cd "$FRONTEND" && npx eslint . --ext .ts,.tsx --max-warnings 0 2>&1); then
        ok "eslint passed"
    else
        fail "eslint found issues"
    fi
else
    skip "eslint (no frontend or npx)"
fi

# ── Python: mypy (type checking, non-blocking) ────────────────────────────────
echo ""
echo "Python — mypy (type hints)"
if command -v mypy &>/dev/null; then
    for d in app-backend feedback-service mlops-service; do
        if [[ -d "$ROOT/$d" ]]; then
            if mypy "$ROOT/$d" \
                --ignore-missing-imports \
                --no-error-summary \
                --quiet 2>&1; then
                ok "mypy: $d"
            else
                # mypy failures are warnings — don't block CI yet
                echo "  ~  mypy: $d (type errors found — non-blocking)"
            fi
        fi
    done
else
    skip "mypy"
fi

echo ""
echo "─────────────────────────────"
if [[ $ERRORS -eq 0 ]]; then
    echo "✓ All lint checks passed"
    exit 0
else
    echo "✗ $ERRORS lint check(s) failed"
    exit 1
fi
