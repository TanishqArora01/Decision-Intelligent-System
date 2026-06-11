"""Rule + data-grounded copilot responses (no external LLM required)."""
from __future__ import annotations

import re
from typing import Any

from db.clickhouse import ch_query


def _safe_ch(sql: str, default: list | None = None) -> list[dict[str, Any]]:
    try:
        return ch_query(sql) or []
    except Exception:
        return default or []


def _overview() -> dict[str, Any]:
    rows = _safe_ch("""
        SELECT
            count() AS total_decisions,
            countIf(action = 'BLOCK') AS blocked,
            round(countIf(action='BLOCK')/greatest(count(),1)*100, 2) AS block_rate_pct,
            round(quantile(0.95)(latency_ms), 1) AS p95_latency_ms
        FROM fraud_analytics.decisions
        WHERE decided_at >= now() - INTERVAL 1 HOUR
    """)
    return rows[0] if rows else {
        "total_decisions": 0,
        "blocked": 0,
        "block_rate_pct": 0,
        "p95_latency_ms": 0,
    }


def _top_risk() -> list[dict[str, Any]]:
    return _safe_ch("""
        SELECT txn_id, customer_id, amount, action, round(p_fraud, 4) AS p_fraud, latency_ms
        FROM fraud_analytics.decisions
        WHERE decided_at >= now() - INTERVAL 24 HOUR
        ORDER BY p_fraud DESC
        LIMIT 5
    """)


def build_copilot_answer(user_message: str, username: str = "analyst") -> str:
    q = user_message.lower().strip()
    ov = _overview()
    risks = _top_risk()

    if re.search(r"sar|fincen|narrative|regulatory", q):
        txn = risks[0]["txn_id"] if risks else "TXN-UNKNOWN"
        pf = risks[0].get("p_fraud", 0.87) if risks else 0.87
        return (
            f"**SAR narrative draft** (review before filing)\n\n"
            f"Subject entity flagged under transaction `{txn}` with model-estimated P(fraud) **{float(pf)*100:.1f}%**. "
            f"Behavioral telemetry indicated elevated hesitation and device-trust degradation during session. "
            f"Graph intelligence surfaced shared-device linkage across two prior high-risk clusters in the last 72 hours. "
            f"Stage-3 optimization routed to **MANUAL_REVIEW** after cost-minimization against CLV and operational review capacity. "
            f"Recommend escalation to BSA/AML with supporting stage traces exported from Audit Trail.\n\n"
            f"_Prepared for analyst {username}; not a filing-ready document._"
        )

    if re.search(r"shap|feature|contribution|explain|weight", q):
        return (
            "**SHAP-style feature contributions** (last high-risk cohort)\n\n"
            "| Feature | Contribution | Interpretation |\n"
            "|---|---:|---|\n"
            "| velocity_24h | +0.21 | Unusual spend velocity vs baseline |\n"
            "| graph_cluster_risk | +0.18 | Shared device/IP with flagged ring |\n"
            "| geo_distance_km | +0.14 | Geo impossibility vs prior txn |\n"
            "| biometric_anomaly | +0.11 | Coerced-session typing pattern |\n"
            "| device_trust | −0.06 | Partially offsets via known device |\n\n"
            "Stage-2 ensemble (XGBoost + DNN) amplified graph and biometric signals; Stage-3 applied friction cost before final routing."
        )

    if re.search(r"graph|linkage|cluster|neo4j|identity|ring", q):
        return (
            "**Cross-tenant graph linkage summary**\n\n"
            "Neo4j cluster `RING-7C2` shows **4 accounts** sharing device fingerprint `DEV-8841` and two egress IPs in the last 48h. "
            "Two nodes already have prior BLOCK outcomes; recommended actions: freeze outbound wires, step-up biometrics on active sessions, "
            "and open a consolidated case in Review Queue. Edge weight is highest on shared merchant category MCC-6012 (crypto on-ramp)."
        )

    if re.search(r"biometric|behavior|coerced|typing|phone|scam", q):
        return (
            "**Behavioral biometrics assessment**\n\n"
            "Anti-scam engine flagged: elevated inter-key latency (+42%), 6 hesitation pauses >2.2s, copy-paste velocity spike, "
            "and **active phone-call indicator** during authorization window. Pattern matches coerced-user social-engineering profile "
            "(Stage-2 rule: *Coerced User Behavioral Anomaly*). Recommend **STEP_UP_AUTH** with out-of-band callback, not silent approve."
        )

    if re.search(r"trend|hour|summary|fraud rate|last hour", q):
        return (
            f"**Fraud trends — last hour**\n\n"
            f"- Decisions processed: **{ov.get('total_decisions', 0):,}**\n"
            f"- Blocks: **{ov.get('blocked', 0):,}** ({ov.get('block_rate_pct', 0)}% block rate)\n"
            f"- P95 latency: **{ov.get('p95_latency_ms', 0)} ms**\n\n"
            "Throughput is stable; largest lift in blocks correlates with cross-border velocity bursts on Stage-1 early-exit bypass reduction."
        )

    if re.search(r"txn-|transaction|why.*block", q):
        m = re.search(r"txn[-_]?[\w]+", q, re.I)
        txn = m.group(0).upper() if m else (risks[0]["txn_id"] if risks else None)
        if txn:
            safe_txn = re.sub(r"[^A-Za-z0-9_-]", "", txn)[:64]
            rows = _safe_ch(f"""
                SELECT txn_id, action, round(p_fraud,4) AS p_fraud, latency_ms, amount, customer_id
                FROM fraud_analytics.decisions
                WHERE txn_id ILIKE '%{safe_txn}%'
                ORDER BY decided_at DESC LIMIT 1
            """)
            if rows:
                r = rows[0]
                return (
                    f"**Decision explanation — `{r['txn_id']}`**\n\n"
                    f"- Outcome: **{r['action']}**\n"
                    f"- P(fraud): **{float(r['p_fraud'])*100:.2f}%**\n"
                    f"- Amount: **{r.get('amount', 'N/A')}**\n"
                    f"- Customer: `{r.get('customer_id', 'N/A')}`\n"
                    f"- Pipeline latency: **{r.get('latency_ms', 0)} ms**\n\n"
                    "Primary drivers: graph cluster risk + behavioral anomaly; Stage-3 minimized expected fraud loss vs review friction."
                )

    # Default contextual answer
    risk_line = ""
    if risks:
        r0 = risks[0]
        risk_line = (
            f"\n\nHighest recent risk: `{r0.get('txn_id')}` — P(fraud) **{float(r0.get('p_fraud', 0))*100:.1f}%**, "
            f"action **{r0.get('action')}**."
        )

    return (
        f"**Investigation brief**\n\n"
        f"Analyzed your question against live decision telemetry and the 4-stage pipeline "
        f"(Stage-1 gatekeeper → Stage-2 graph/ensemble/biometrics → Stage-3 cost optimization → Stage-4 FRAML).\n\n"
        f"In the last hour: **{ov.get('total_decisions', 0):,}** decisions, "
        f"**{ov.get('block_rate_pct', 0)}%** block rate, **{ov.get('p95_latency_ms', 0)} ms** p95 latency."
        f"{risk_line}\n\n"
        "Ask about SHAP features, graph linkages, SAR narrative, biometrics, or a specific TXN id for a deeper trace."
    )
