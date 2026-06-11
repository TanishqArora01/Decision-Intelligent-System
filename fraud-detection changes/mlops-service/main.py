"""
mlops-service/main.py
MLOps Automation Service

Watches the labels-confirmed Kafka topic (published by feedback-service)
and drives the automated training → validation → deployment lifecycle.

Responsibilities:
  1. Accumulate label counts per model version
  2. When N new labels arrive → trigger incremental retraining
  3. Run automated validation gates on the new model (AUC, FNR, PSI drift)
  4. If all gates pass → auto-promote to Staging (human approval needed for Production)
  5. If FNR > emergency threshold → alert + consider auto-rollback

Also exposes:
  GET /status           — current label counts + model versions
  GET /gates/{model}    — current gate results for a model version
  POST /trigger-retrain — manually trigger retraining
  POST /validate/{model}/{version} — manually run validation gates

Design: the feedback-service feeds labels in real-time.
        This service counts them and decides when to act.
        The Airflow DAGs handle the heavy compute (actual training).
        This service is the DECISION MAKER, Airflow is the EXECUTOR.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from prometheus_client import Counter, Gauge, make_asgi_app

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("mlops-service")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
KAFKA_BROKERS        = os.getenv("KAFKA_BOOTSTRAP_SERVERS",   "redpanda:9092")
TOPIC_LABELS_CONF    = os.getenv("TOPIC_LABEL_CONFIRMED",      "labels-confirmed")
CONSUMER_GROUP       = os.getenv("CONSUMER_GROUP",             "mlops-service-v1")
MLFLOW_URI           = os.getenv("MLFLOW_TRACKING_URI",        "http://mlflow:5000")
AIRFLOW_API          = os.getenv("AIRFLOW_API_URL",            "http://airflow-webserver:8080/api/v1")
AIRFLOW_USER         = os.getenv("AIRFLOW_USER",               "admin")
AIRFLOW_PASS         = os.getenv("AIRFLOW_PASSWORD",           "fraud_admin_2024")
RETRAIN_LABEL_THRESHOLD = int(os.getenv("RETRAIN_LABEL_THRESHOLD", "500"))
EMERGENCY_FNR_THRESHOLD = float(os.getenv("EMERGENCY_FNR_THRESHOLD", "0.20"))
MIN_AUC_GATE         = float(os.getenv("MIN_AUC_GATE",         "0.90"))
MAX_FNR_GATE         = float(os.getenv("MAX_FNR_GATE",         "0.15"))
MAX_PSI_GATE         = float(os.getenv("MAX_PSI_GATE",         "0.25"))
METRICS_PORT         = int(os.getenv("METRICS_PORT",           "9111"))

# ---------------------------------------------------------------------------
# Prometheus
# ---------------------------------------------------------------------------
LABELS_ACCUMULATED = Gauge("mlops_labels_accumulated",    "Labels since last retrain", ["model_version"])
RETRAINS_TRIGGERED = Counter("mlops_retrains_triggered_total", "Retraining triggers")
GATE_RESULTS       = Gauge("mlops_gate_result",           "Gate result (1=pass 0=fail)", ["gate", "model_version"])
AUTO_PROMOTIONS    = Counter("mlops_auto_promotions_total","Automatic Staging promotions")
EMERGENCY_ALERTS   = Counter("mlops_emergency_alerts_total","Emergency FNR alerts")


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
@dataclass
class ModelLabelState:
    model_version:       str
    labels_since_retrain:int   = 0
    last_fnr:            float = 0.0
    last_fpr:            float = 0.0
    last_label_at:       str   = ""
    retrain_triggered:   bool  = False
    retrain_triggered_at:str   = ""


class MLOpsState:
    def __init__(self):
        self._state: Dict[str, ModelLabelState] = defaultdict(
            lambda: ModelLabelState(model_version="unknown")
        )
        self._lock = threading.Lock()

    def record_label(self, model_version: str, fnr: float, fpr: float):
        with self._lock:
            s = self._state[model_version]
            s.model_version       = model_version
            s.labels_since_retrain += 1
            s.last_fnr             = fnr
            s.last_fpr             = fpr
            s.last_label_at        = datetime.now(timezone.utc).isoformat()
            LABELS_ACCUMULATED.labels(model_version=model_version).set(s.labels_since_retrain)

    def should_retrain(self, model_version: str) -> bool:
        with self._lock:
            s = self._state.get(model_version)
            if not s: return False
            return (s.labels_since_retrain >= RETRAIN_LABEL_THRESHOLD
                    and not s.retrain_triggered)

    def is_emergency(self, model_version: str) -> bool:
        with self._lock:
            s = self._state.get(model_version)
            if not s: return False
            return s.last_fnr > EMERGENCY_FNR_THRESHOLD

    def mark_retrain_triggered(self, model_version: str):
        with self._lock:
            s = self._state[model_version]
            s.retrain_triggered    = True
            s.retrain_triggered_at = datetime.now(timezone.utc).isoformat()
            s.labels_since_retrain = 0  # reset counter

    def to_dict(self) -> dict:
        with self._lock:
            return {mv: {
                "model_version":        s.model_version,
                "labels_since_retrain": s.labels_since_retrain,
                "last_fnr":             s.last_fnr,
                "last_fpr":             s.last_fpr,
                "last_label_at":        s.last_label_at,
                "retrain_triggered":    s.retrain_triggered,
            } for mv, s in self._state.items()}


state = MLOpsState()


# ---------------------------------------------------------------------------
# Airflow DAG trigger
# ---------------------------------------------------------------------------
def trigger_airflow_dag(dag_id: str, conf: dict = None) -> bool:
    """Trigger an Airflow DAG via its REST API."""
    try:
        import httpx
        response = httpx.post(
            f"{AIRFLOW_API}/dags/{dag_id}/dagRuns",
            json={"conf": conf or {}},
            auth=(AIRFLOW_USER, AIRFLOW_PASS),
            timeout=10.0,
        )
        if response.status_code in (200, 201):
            logger.info("Triggered Airflow DAG: %s", dag_id)
            return True
        logger.warning("Airflow trigger failed: %d %s", response.status_code, response.text[:100])
        return False
    except Exception as e:
        logger.warning("Airflow API unavailable: %s", e)
        return False


# ---------------------------------------------------------------------------
# Validation gates
# ---------------------------------------------------------------------------
@dataclass
class GateResult:
    gate_name: str
    passed:    bool
    value:     float
    threshold: float
    detail:    str = ""


def run_validation_gates(model_name: str, version: str) -> Dict[str, GateResult]:
    """
    Run all validation gates for a model version in MLflow.
    Returns dict of gate_name → GateResult.
    """
    gates: Dict[str, GateResult] = {}

    try:
        import mlflow
        mlflow.set_tracking_uri(MLFLOW_URI)
        client = mlflow.tracking.MlflowClient()
        mv     = client.get_model_version(model_name, version)

        # Gate 1: val_auc
        val_auc = float(mv.tags.get("val_auc", 0.0))
        g1 = GateResult("val_auc", val_auc >= MIN_AUC_GATE, val_auc, MIN_AUC_GATE,
                         f"AUC={val_auc:.4f} (min {MIN_AUC_GATE})")
        gates["val_auc"] = g1
        GATE_RESULTS.labels(gate="val_auc", model_version=f"{model_name}:{version}").set(int(g1.passed))

        # Gate 2: fn_rate
        fn_rate = float(mv.tags.get("fn_rate", 1.0))
        g2 = GateResult("fn_rate", fn_rate <= MAX_FNR_GATE, fn_rate, MAX_FNR_GATE,
                         f"FNR={fn_rate:.4f} (max {MAX_FNR_GATE})")
        gates["fn_rate"] = g2
        GATE_RESULTS.labels(gate="fn_rate", model_version=f"{model_name}:{version}").set(int(g2.passed))

        # Gate 3: drift check (PSI from tag)
        psi = float(mv.tags.get("max_psi", 0.0))
        g3 = GateResult("max_psi", psi <= MAX_PSI_GATE, psi, MAX_PSI_GATE,
                         f"PSI={psi:.4f} (max {MAX_PSI_GATE})")
        gates["max_psi"] = g3
        GATE_RESULTS.labels(gate="max_psi", model_version=f"{model_name}:{version}").set(int(g3.passed))

    except Exception as e:
        logger.warning("Validation gates failed for %s:%s — %s", model_name, version, e)
        gates["error"] = GateResult("error", False, 0.0, 0.0, str(e))

    return gates


def auto_promote_if_gates_pass(model_name: str, version: str):
    """Promote model to Staging automatically if all gates pass."""
    gates = run_validation_gates(model_name, version)
    all_pass = all(g.passed for g in gates.values())

    if all_pass:
        try:
            import mlflow
            mlflow.set_tracking_uri(MLFLOW_URI)
            client = mlflow.tracking.MlflowClient()
            client.transition_model_version_stage(model_name, version, "Staging")
            client.set_model_version_tag(model_name, version,
                                          "auto_promoted_at",
                                          datetime.now(timezone.utc).isoformat())
            AUTO_PROMOTIONS.inc()
            logger.info("Auto-promoted %s v%s → Staging (all gates passed)", model_name, version)
        except Exception as e:
            logger.error("Auto-promotion failed: %s", e)
    else:
        failed = [g.gate_name for g in gates.values() if not g.passed]
        logger.info("Gates failed for %s v%s — not promoting: %s", model_name, version, failed)


# ---------------------------------------------------------------------------
# Kafka consumer
# ---------------------------------------------------------------------------
_stop = threading.Event()


def consume_label_confirmed():
    """Consume labels-confirmed topic and drive MLOps decisions."""
    try:
        from confluent_kafka import Consumer
        c = Consumer({
            "bootstrap.servers":  KAFKA_BROKERS,
            "group.id":           CONSUMER_GROUP,
            "auto.offset.reset":  "latest",
            "enable.auto.commit": True,
        })
        c.subscribe([TOPIC_LABELS_CONF])
        logger.info("MLOps label consumer started → %s", TOPIC_LABELS_CONF)

        while not _stop.is_set():
            msg = c.poll(1.0)
            if not msg or msg.error():
                continue
            try:
                ev = json.loads(msg.value().decode())
                mv = ev.get("model_version", "unknown")
                fnr= float(ev.get("fnr", 0.0))
                fpr= float(ev.get("fpr", 0.0))

                state.record_label(mv, fnr, fpr)

                # Emergency alert
                if state.is_emergency(mv):
                    EMERGENCY_ALERTS.inc()
                    logger.error(
                        "EMERGENCY: FNR=%.3f > %.3f for model %s — "
                        "triggering immediate retraining",
                        fnr, EMERGENCY_FNR_THRESHOLD, mv
                    )
                    trigger_airflow_dag("model_retraining",
                                        {"triggered_by": "emergency_fnr", "model_version": mv})

                # Normal retraining threshold
                elif state.should_retrain(mv):
                    logger.info("Label threshold reached for %s (%d labels) — triggering retrain",
                                mv, RETRAIN_LABEL_THRESHOLD)
                    ok = trigger_airflow_dag("model_retraining",
                                            {"triggered_by": "label_threshold", "model_version": mv})
                    if ok:
                        state.mark_retrain_triggered(mv)
                        RETRAINS_TRIGGERED.inc()

            except Exception as e:
                logger.error("Label event processing error: %s", e)

        c.close()
    except Exception as e:
        logger.error("MLOps consumer failed: %s", e)


# ---------------------------------------------------------------------------
# FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(title="MLOps Automation Service", version="1.0.0")
app.mount("/metrics", make_asgi_app())


@app.get("/health")
async def health():
    return {"status": "ok", "service": "mlops-service"}


@app.get("/status")
async def status():
    return {"label_state": state.to_dict()}


@app.get("/gates/{model_name}/{version}")
async def get_gates(model_name: str, version: str):
    gates = run_validation_gates(model_name, version)
    return {
        "model_name": model_name,
        "version":    version,
        "gates":      {k: {"passed": g.passed, "value": g.value, "detail": g.detail}
                       for k, g in gates.items()},
        "all_passed": all(g.passed for g in gates.values()),
    }


@app.post("/trigger-retrain")
async def trigger_retrain(model_name: str = "all"):
    ok = trigger_airflow_dag("model_retraining",
                              {"triggered_by": "manual", "model_name": model_name})
    if not ok:
        raise HTTPException(503, "Failed to trigger Airflow DAG — check Airflow connectivity")
    RETRAINS_TRIGGERED.inc()
    return {"status": "triggered", "dag": "model_retraining"}


@app.post("/validate/{model_name}/{version}")
async def validate_model(model_name: str, version: str, auto_promote: bool = False):
    gates   = run_validation_gates(model_name, version)
    all_ok  = all(g.passed for g in gates.values())
    if auto_promote and all_ok:
        auto_promote_if_gates_pass(model_name, version)
    return {
        "model_name": model_name,
        "version":    version,
        "all_passed": all_ok,
        "promoted":   all_ok and auto_promote,
        "gates":      {k: {"passed": g.passed, "value": g.value, "detail": g.detail}
                       for k, g in gates.items()},
    }


if __name__ == "__main__":
    t = threading.Thread(target=consume_label_confirmed, daemon=True)
    t.start()

    try:
        from prometheus_client import start_http_server
        start_http_server(METRICS_PORT)
    except Exception: pass

    port = int(os.getenv("PORT", "8700"))
    uvicorn.run(app, host="0.0.0.0", port=port,
                log_level=os.getenv("LOG_LEVEL", "info").lower())
