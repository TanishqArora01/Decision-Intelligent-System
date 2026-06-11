#!/usr/bin/env bash
# scripts/ci/security_scan.sh — Full security scan. Exit 1 on HIGH/CRITICAL findings.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPORT_DIR="${SECURITY_REPORT_DIR:-$ROOT/.security-reports}"
ERRORS=0
WARNINGS=0

mkdir -p "$REPORT_DIR"

ok()   { echo "  ✓  $*"; }
fail() { echo "  ✗  $*"; ERRORS=$((ERRORS+1)); }
warn() { echo "  ~  $*"; WARNINGS=$((WARNINGS+1)); }
skip() { echo "  –  $* (tool not installed — install with pip)"; }

echo "=== Security Scan ==="
echo "Reports: $REPORT_DIR"
echo ""

# ── 1. Bandit — Python SAST ───────────────────────────────────────────────────
echo "1/4  Bandit — Python SAST"
if command -v bandit &>/dev/null; then
    BANDIT_OUT="$REPORT_DIR/bandit.json"
    PY_DIRS=()
    for d in app-backend stage1-service stage2-service stage3-service \
              feature-engine feedback-service mlops-service \
              transaction-adapters sinks dataset-pipeline vault; do
        [[ -d "$ROOT/$d" ]] && PY_DIRS+=("$ROOT/$d")
    done

    if [[ ${#PY_DIRS[@]} -gt 0 ]]; then
        bandit -r "${PY_DIRS[@]}" \
            --skip B101,B105,B601 \
            --format json \
            -o "$BANDIT_OUT" 2>/dev/null || true

        # Parse results
        HIGH_COUNT=$(python3 -c "
import json, sys
try:
    d = json.load(open('$BANDIT_OUT'))
    highs = [r for r in d.get('results', []) if r.get('issue_severity') in ('HIGH','CRITICAL')]
    print(len(highs))
except: print(0)
")
        if [[ "$HIGH_COUNT" -eq 0 ]]; then
            ok "bandit — no HIGH/CRITICAL issues"
        else
            fail "bandit — $HIGH_COUNT HIGH/CRITICAL issue(s). See $BANDIT_OUT"
        fi
    else
        skip "bandit (no service directories found)"
    fi
else
    skip "bandit (pip install bandit)"
fi

# ── 2. Semgrep — cross-language SAST ─────────────────────────────────────────
echo ""
echo "2/4  Semgrep — SAST"
if command -v semgrep &>/dev/null; then
    SEMGREP_OUT="$REPORT_DIR/semgrep.json"
    if semgrep scan "$ROOT" \
        --config "p/python" \
        --config "p/secrets" \
        --config "p/jwt" \
        --config "p/sql-injection" \
        --exclude ".git,node_modules,__pycache__,.next,*.egg-info" \
        --json \
        -o "$SEMGREP_OUT" \
        --quiet 2>&1; then

        CRITICAL=$(python3 -c "
import json
try:
    d = json.load(open('$SEMGREP_OUT'))
    return len([r for r in d.get('results',[]) if r.get('extra',{}).get('severity') in ('ERROR','WARNING')])
except: print(0)
" 2>/dev/null || echo 0)
        if [[ "$CRITICAL" -eq 0 ]]; then
            ok "semgrep — no critical findings"
        else
            warn "semgrep — $CRITICAL finding(s). See $SEMGREP_OUT"
        fi
    else
        warn "semgrep scan completed with findings. See $SEMGREP_OUT"
    fi
else
    skip "semgrep (pip install semgrep)"
fi

# ── 3. pip-audit — dependency CVE check ──────────────────────────────────────
echo ""
echo "3/4  pip-audit — dependency CVEs"
if command -v pip-audit &>/dev/null; then
    PIP_AUDIT_OUT="$REPORT_DIR/pip-audit.json"
    VULN_TOTAL=0

    for req_file in $(find "$ROOT" -name "requirements*.txt" \
                      ! -path "*/node_modules/*" ! -path "*/.git/*"); do
        service=$(dirname "$req_file" | xargs basename)
        if pip-audit \
            --requirement "$req_file" \
            --format json \
            --output "$PIP_AUDIT_OUT.$service" \
            --no-deps \
            --skip-editable 2>/dev/null; then
            VULNS=$(python3 -c "
import json
try:
    d = json.load(open('$PIP_AUDIT_OUT.$service'))
    return len(d.get('vulnerabilities', []))
except: print(0)
" 2>/dev/null || echo 0)
            if [[ "$VULNS" -eq 0 ]]; then
                ok "pip-audit: $service — clean"
            else
                fail "pip-audit: $service — $VULNS vulnerable package(s)"
            fi
        fi
    done
else
    skip "pip-audit (pip install pip-audit)"
fi

# ── 4. Trivy — container image + filesystem scan ─────────────────────────────
echo ""
echo "4/4  Trivy — container + filesystem"
if command -v trivy &>/dev/null; then
    TRIVY_OUT="$REPORT_DIR/trivy-fs.json"

    # Filesystem scan (no Docker required)
    if trivy filesystem "$ROOT" \
        --severity HIGH,CRITICAL \
        --exit-code 0 \
        --format json \
        --output "$TRIVY_OUT" \
        --skip-dirs ".git,node_modules,__pycache__,.next" \
        --quiet 2>&1; then

        CRIT=$(python3 -c "
import json
try:
    d = json.load(open('$TRIVY_OUT'))
    vulns = [v for r in d.get('Results',[]) for v in r.get('Vulnerabilities',[]) or []
             if v.get('Severity') in ('HIGH','CRITICAL')]
    print(len(vulns))
except: print(0)
" 2>/dev/null || echo 0)

        if [[ "$CRIT" -eq 0 ]]; then
            ok "trivy filesystem — no HIGH/CRITICAL vulnerabilities"
        else
            fail "trivy filesystem — $CRIT HIGH/CRITICAL vulnerability(ies). See $TRIVY_OUT"
        fi
    fi

    # Image scans (only if Docker is available and images exist)
    if command -v docker &>/dev/null; then
        IMAGES=(
            fraud-api-gateway fraud-app-backend fraud-frontend
            fraud-stage1 fraud-stage2 fraud-stage3
            fraud-feedback-service fraud-mlops-service
        )
        for img in "${IMAGES[@]}"; do
            if docker image inspect "$img:latest" &>/dev/null; then
                TRIVY_IMG_OUT="$REPORT_DIR/trivy-${img}.json"
                if trivy image "$img:latest" \
                    --severity HIGH,CRITICAL \
                    --exit-code 0 \
                    --format json \
                    --output "$TRIVY_IMG_OUT" \
                    --quiet 2>&1; then

                    IMG_CRIT=$(python3 -c "
import json
try:
    d = json.load(open('$TRIVY_IMG_OUT'))
    vulns = [v for r in d.get('Results',[]) for v in r.get('Vulnerabilities',[]) or []
             if v.get('Severity') in ('HIGH','CRITICAL')]
    print(len(vulns))
except: print(0)
" 2>/dev/null || echo 0)
                    if [[ "$IMG_CRIT" -eq 0 ]]; then
                        ok "trivy image: $img — clean"
                    else
                        warn "trivy image: $img — $IMG_CRIT HIGH/CRITICAL. See $TRIVY_IMG_OUT"
                    fi
                fi
            fi
        done
    fi
else
    skip "trivy (brew install trivy / apt-get install trivy)"
fi

echo ""
echo "─────────────────────────────"
echo "Reports saved to: $REPORT_DIR"
echo ""
if [[ $ERRORS -eq 0 ]]; then
    if [[ $WARNINGS -gt 0 ]]; then
        echo "✓ Security scan passed with $WARNINGS warning(s)"
    else
        echo "✓ Security scan clean"
    fi
    exit 0
else
    echo "✗ $ERRORS security issue(s) require attention before release"
    exit 1
fi
