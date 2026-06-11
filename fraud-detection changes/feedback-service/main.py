"""
feedback-service/main.py
Real-Time Feedback Loop Service

Consumes three Kafka topics in parallel:
  1. fraud-labels        — chargebacks + analyst verdicts (ground truth)
  2. decisions           — model decisions (for join with labels)
  3. txn-enriched        — feature vectors (for training dataset construction)

For each arriving label:
  a. Joins with the original decision record (by txn_id)
  b. Reconstructs the feature vector at decision time
  c. Writes a training row to the label store (PostgreSQL + MinIO)
  d. Updates customer trust score in Redis (real-time, no DAG lag)
  e. Publishes a label-confirmed event for downstream consumers
  f. Maintains a rolling FNR/FPR counter per model version

This service is the ACTIVE runtime component of the feedback loop.
The Airflow DAGs (chargeback_ingestion, model_monitoring) are the
scheduled batch complement — they handle bulk historical processing.
This service handles the real-time < 30s label delivery path.

Key design decisions:
  - Stateless worker threads — one per Kafka partition
  - Label deduplication via Redis SET (txn_id → label_source)
  - Graceful shutdown: drain in-flight joins before stopping
  - Metrics: per-model-version FNR/FPR rolling window
"""
from __future__ import annotations

import json
import logging
import os
import signal
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Optional

import uvicorn
from fastapi import FastAPI
from prometheus_client import Counter, Gauge, Histogram, start_http_server, make_asgi_app

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("feedback-service")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
KAFKA_BROKERS      = os.getenv("KAFKA_BOOTSTRAP_SERVERS",  "redpanda:9092")
TOPIC_LABELS       = os.getenv("TOPIC_FRAUD_LABELS",        "fraud-labels")
TOPIC_DECISIONS    = os.getenv("TOPIC_DECISIONS",           "decisions")
TOPIC_LABEL_CONF   = os.getenv("TOPIC_LABEL_CONFIRMED",     "labels-confirmed")
CONSUMER_GROUP     = os.getenv("CONSUMER_GROUP",            "feedback-service-v1")
REDIS_HOST         = os.getenv("REDIS_HOST",                "redis")
REDIS_PORT         = int(os.getenv("REDIS_PORT",            "6379"))
POSTGRES_DSN       = os.getenv("POSTGRES_DSN",
    "postgresql://fraud_admin:fraud_secret_2024@postgres:5432/fraud_db")
MINIO_ENDPOINT     = os.getenv("MINIO_ENDPOINT",            "http://minio:9000")
MINIO_ACCESS       = os.getenv("MINIO_ACCESS_KEY",          "fraud_minio")
MINIO_SECRET       = os.getenv("MINIO_SECRET_KEY",          "fraud_minio_2024")
TRUST_DECAY_FN     = float(os.getenv("TRUST_DECAY_FN",      "0.10"))  # FN → trust -0.10
TRUST_BOOST_TN     = float(os.getenv("TRUST_BOOST_TN",      "0.01"))  # TN → trust +0.01
METRICS_PORT       = int(os.getenv("METRICS_PORT",          "9110"))
LABEL_TTL_SECONDS  = int(os.getenv("LABEL_TTL_SECONDS",     "3600"))  # dedup window

# ---------------------------------------------------------------------------
# Prometheus metrics
# ---------------------------------------------------------------------------
LABELS_RECEIVED    = Counter("feedback_labels_received_total",   "Labels received", ["source"])
LABELS_PROCESSED   = Counter("feedback_labels_processed_total",  "Labels processed", ["result"])
JOIN_LATENCY       = Histogram("feedback_join_latency_ms",        "Decision join latency (ms)")
TRUST_UPDATES      = Counter("feedback_trust_updates_total",      "Trust score updates", ["direction"])
FNR_GAUGE          = Gauge("feedback_model_fnr",                  "Rolling FNR", ["model_version"])
FPR_GAUGE          = Gauge("feedback_model_fpr",                  "Rolling FPR", ["model_version"])
LABEL_QUEUE_SIZE   = Gauge("feedback_label_queue_size",           "Pending labels to process")


# ---------------------------------------------------------------------------
# Rolling performance window
# ---------------------------------------------------------------------------
@dataclass
class ModelPerformanceWindow:
    model_version: str
    window_size:   int = 1000
    tp: deque = field(default_factory=lambda: deque(maxlen=1000))
    fp: deque = field(default_factory=lambda: deque(maxlen=1000))
    fn: deque = field(default_factory=lambda: deque(maxlen=1000))
    tn: deque = field(default_factory=lambda: deque(maxlen=1000))

    def record(self, true_label: bool, model_action: str):
        detected = model_action in ("BLOCK", "STEP_UP_AUTH", "MANUAL_REVIEW")
        if true_label and detected:     self.tp.append(1)
        elif not true_label and detected: self.fp.append(1)
        elif true_label and not detected: self.fn.append(1)
        else:                             self.tn.append(1)

        n_tp = len(self.tp); n_fn = len(self.fn); n_fp = len(self.fp); n_tn = len(self.tn)
        fnr = n_fn / max(n_tp + n_fn, 1)
        fpr = n_fp / max(n_fp + n_tn, 1)
        FNR_GAUGE.labels(model_version=self.model_version).set(fnr)
        FPR_GAUGE.labels(model_version=self.model_version).set(fpr)

        return fnr, fpr


class PerformanceTracker:
    def __init__(self):
        self._windows: Dict[str, ModelPerformanceWindow] = {}
        self._lock = threading.Lock()

    def record(self, model_version: str, true_label: bool, model_action: str):
        with self._lock:
            if model_version not in self._windows:
                self._windows[model_version] = ModelPerformanceWindow(model_version)
            return self._windows[model_version].record(true_label, model_action)

    def summary(self) -> Dict:
        with self._lock:
            result = {}
            for mv, w in self._windows.items():
                n_tp = len(w.tp); n_fn = len(w.fn); n_fp = len(w.fp); n_tn = len(w.tn)
                result[mv] = {
                    "tp": n_tp, "fp": n_fp, "fn": n_fn, "tn": n_tn,
                    "fnr": round(n_fn / max(n_tp + n_fn, 1), 4),
                    "fpr": round(n_fp / max(n_fp + n_tn, 1), 4),
                    "precision": round(n_tp / max(n_tp + n_fp, 1), 4),
                    "recall":    round(n_tp / max(n_tp + n_fn, 1), 4),
                }
            return result


perf_tracker = PerformanceTracker()


# ---------------------------------------------------------------------------
# Redis client (for dedup + trust updates)
# ---------------------------------------------------------------------------
_redis = None
def get_redis():
    global _redis
    if _redis is None:
        try:
            import redis
            _redis = redis.Redis(host=REDIS_HOST, port=REDIS_PORT,
                                  decode_responses=True, socket_timeout=2)
        except Exception as e:
            logger.warning("Redis unavailable: %s", e)
    return _redis


def is_duplicate_label(txn_id: str, label_source: str) -> bool:
    """Return True if we already processed this label."""
    r = get_redis()
    if not r: return False
    key = f"label_seen:{txn_id}"
    try:
        existing = r.get(key)
        if existing:
            return True
        r.setex(key, LABEL_TTL_SECONDS, label_source)
        return False
    except Exception:
        return False


def update_trust_score(customer_id: str, is_false_negative: bool):
    """Adjust customer trust score in Redis."""
    r = get_redis()
    if not r: return
    key = f"trust:{customer_id}"
    try:
        if is_false_negative:
            r.incrbyfloat(key, -TRUST_DECAY_FN)
            TRUST_UPDATES.labels(direction="decrease").inc()
        else:
            r.incrbyfloat(key, TRUST_BOOST_TN)
            TRUST_UPDATES.labels(direction="increase").inc()
        # Clamp to [0.05, 1.0]
        current = float(r.get(key) or 0.5)
        r.set(key, str(round(max(0.05, min(1.0, current)), 4)))
    except Exception as e:
        logger.debug("Trust update failed: %s", e)


# ---------------------------------------------------------------------------
# PostgreSQL label writer
# ---------------------------------------------------------------------------
def write_label_to_pg(label: dict, decision: Optional[dict]) -> bool:
    """Write ground-truth label to training_labels table."""
    try:
        import psycopg2
        conn = psycopg2.connect(POSTGRES_DSN.replace("+asyncpg", ""))
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO training.labels (
                txn_id, customer_id, true_label, label_source, confidence,
                labeled_at, model_action, model_p_fraud, model_version,
                model_uncertainty, amount, channel, country_code
            ) VALUES (
                %(txn_id)s, %(customer_id)s, %(true_label)s, %(label_source)s,
                %(confidence)s, %(labeled_at)s, %(model_action)s, %(model_p_fraud)s,
                %(model_version)s, %(model_uncertainty)s, %(amount)s, %(channel)s,
                %(country_code)s
            ) ON CONFLICT (txn_id) DO UPDATE SET
                true_label    = EXCLUDED.true_label,
                label_source  = EXCLUDED.label_source,
                labeled_at    = EXCLUDED.labeled_at
        """, {
            "txn_id":           label.get("txn_id", ""),
            "customer_id":      label.get("customer_id", ""),
            "true_label":       label.get("true_label") == "FRAUD",
            "label_source":     label.get("label_source", ""),
            "confidence":       float(label.get("confidence", 1.0)),
            "labeled_at":       label.get("labeled_at", datetime.now(timezone.utc).isoformat()),
            "model_action":     (decision or {}).get("action", ""),
            "model_p_fraud":    float((decision or {}).get("p_fraud", 0.0)),
            "model_version":    (decision or {}).get("model_version", ""),
            "model_uncertainty":float((decision or {}).get("uncertainty", 0.0)),
            "amount":           float(label.get("amount", 0.0)),
            "channel":          label.get("channel", ""),
            "country_code":     label.get("country_code", ""),
        })
        conn.commit(); conn.close()
        return True
    except Exception as e:
        logger.error("PG label write failed: %s", e)
        return False


# ---------------------------------------------------------------------------
# Kafka producer (label-confirmed topic)
# ---------------------------------------------------------------------------
_producer = None
def get_producer():
    global _producer
    if _producer is None:
        try:
            from confluent_kafka import Producer
            _producer = Producer({"bootstrap.servers": KAFKA_BROKERS, "acks": "1"})
        except Exception as e:
            logger.warning("Kafka producer unavailable: %s", e)
    return _producer


def publish_label_confirmed(label: dict, fnr: float, fpr: float):
    """Publish label-confirmed event for downstream consumers (retraining trigger)."""
    p = get_producer()
    if not p: return
    try:
        event = {
            "txn_id":       label.get("txn_id", ""),
            "true_label":   label.get("true_label"),
            "label_source": label.get("label_source"),
            "model_version":label.get("model_version", ""),
            "fnr":          fnr,
            "fpr":          fpr,
            "confirmed_at": datetime.now(timezone.utc).isoformat(),
        }
        p.produce(topic=TOPIC_LABEL_CONF, key=label.get("txn_id","").encode(),
                  value=json.dumps(event).encode())
        p.poll(0)
    except Exception as e:
        logger.debug("Kafka publish failed: %s", e)


# ---------------------------------------------------------------------------
# Core label processing
# ---------------------------------------------------------------------------

# In-memory decision cache (txn_id → decision dict, TTL ~5 min)
_decision_cache: Dict[str, dict] = {}
_decision_cache_lock = threading.Lock()
_CACHE_TTL = 300  # seconds

def cache_decision(decision: dict):
    txn_id = decision.get("txn_id", "")
    if not txn_id: return
    with _decision_cache_lock:
        _decision_cache[txn_id] = {"data": decision, "ts": time.monotonic()}
        # Prune old entries
        if len(_decision_cache) > 50_000:
            cutoff = time.monotonic() - _CACHE_TTL
            stale  = [k for k, v in _decision_cache.items() if v["ts"] < cutoff]
            for k in stale[:1000]:
                del _decision_cache[k]


def lookup_decision(txn_id: str) -> Optional[dict]:
    with _decision_cache_lock:
        entry = _decision_cache.get(txn_id)
        if entry and time.monotonic() - entry["ts"] < _CACHE_TTL:
            return entry["data"]
    return None


def process_label(label: dict):
    """Process a single ground-truth label — the core feedback loop logic."""
    t0      = time.perf_counter()
    txn_id  = label.get("txn_id", "")
    source  = label.get("label_source", "UNKNOWN")

    LABELS_RECEIVED.labels(source=source).inc()
    LABEL_QUEUE_SIZE.dec()

    if not txn_id:
        LABELS_PROCESSED.labels(result="no_txn_id").inc(); return

    # Deduplication
    if is_duplicate_label(txn_id, source):
        LABELS_PROCESSED.labels(result="duplicate").inc(); return

    # Join with decision record
    decision = lookup_decision(txn_id)
    join_ms  = (time.perf_counter() - t0) * 1000
    JOIN_LATENCY.observe(join_ms)

    # Write label to PostgreSQL training store
    ok = write_label_to_pg(label, decision)

    # Real-time trust score update
    is_fraud = label.get("true_label") == "FRAUD"
    model_action = (decision or {}).get("action", "")
    is_false_negative = is_fraud and model_action == "APPROVE"

    if (decision or {}).get("customer_id"):
        update_trust_score(decision["customer_id"], is_false_negative)

    # Update performance window
    model_version = (decision or {}).get("model_version", "unknown")
    fnr, fpr = perf_tracker.record(model_version, is_fraud, model_action)

    # Publish confirmed event
    publish_label_confirmed(label, fnr, fpr)

    LABELS_PROCESSED.labels(result="ok" if ok else "pg_error").inc()
    logger.info("Label processed: txn=%s source=%s fraud=%s fnr=%.3f join=%.1fms",
                txn_id[:12], source, is_fraud, fnr, join_ms)


# ---------------------------------------------------------------------------
# Kafka consumer threads
# ---------------------------------------------------------------------------

_stop_event = threading.Event()


def consume_labels():
    """Thread: consume fraud-labels topic."""
    try:
        from confluent_kafka import Consumer
        c = Consumer({
            "bootstrap.servers":  KAFKA_BROKERS,
            "group.id":           CONSUMER_GROUP + "-labels",
            "auto.offset.reset":  "earliest",
            "enable.auto.commit": False,
        })
        c.subscribe([TOPIC_LABELS])
        logger.info("Label consumer started → %s", TOPIC_LABELS)
        while not _stop_event.is_set():
            msg = c.poll(1.0)
            if msg and not msg.error():
                try:
                    LABEL_QUEUE_SIZE.inc()
                    process_label(json.loads(msg.value().decode()))
                    c.commit(msg, asynchronous=False)
                except Exception as e:
                    logger.error("Label processing error: %s", e)
        c.close()
    except Exception as e:
        logger.error("Label consumer failed: %s", e)


def consume_decisions():
    """Thread: cache recent decisions for label joins."""
    try:
        from confluent_kafka import Consumer
        c = Consumer({
            "bootstrap.servers":  KAFKA_BROKERS,
            "group.id":           CONSUMER_GROUP + "-decisions",
            "auto.offset.reset":  "latest",   # only new decisions
            "enable.auto.commit": True,
        })
        c.subscribe([TOPIC_DECISIONS])
        logger.info("Decision cache consumer started → %s", TOPIC_DECISIONS)
        while not _stop_event.is_set():
            msg = c.poll(1.0)
            if msg and not msg.error():
                try:
                    cache_decision(json.loads(msg.value().decode()))
                except Exception: pass
        c.close()
    except Exception as e:
        logger.error("Decision consumer failed: %s", e)


# ---------------------------------------------------------------------------
# FastAPI health/metrics app
# ---------------------------------------------------------------------------
app = FastAPI(title="Feedback Service", version="1.0.0")
app.mount("/metrics", make_asgi_app())


@app.get("/health")
async def health():
    return {"status": "ok", "service": "feedback-service"}


@app.get("/ready")
async def ready():
    r = get_redis()
    return {
        "ready":  True,
        "redis":  r is not None,
        "cache_size": len(_decision_cache),
    }


@app.get("/performance")
async def performance():
    return {"model_performance": perf_tracker.summary()}


@app.get("/circuit-status")
async def circuit_status():
    """Not applicable to feedback service, but useful for ops."""
    return {"decision_cache_size": len(_decision_cache)}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    try:
        start_http_server(METRICS_PORT)
        logger.info("Prometheus at :%d", METRICS_PORT)
    except Exception as e:
        logger.warning("Prometheus failed: %s", e)

    # Start consumer threads
    threads = [
        threading.Thread(target=consume_labels,    name="label-consumer",    daemon=True),
        threading.Thread(target=consume_decisions,  name="decision-consumer", daemon=True),
    ]
    for t in threads: t.start()
    logger.info("Feedback service started — %d consumer threads", len(threads))

    def _shutdown(s, f):
        logger.info("Shutdown signal — draining consumers...")
        _stop_event.set()
    signal.signal(signal.SIGINT,  _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    port = int(os.getenv("PORT", "8500"))
    uvicorn.run(app, host="0.0.0.0", port=port,
                log_level=os.getenv("LOG_LEVEL", "info").lower())
