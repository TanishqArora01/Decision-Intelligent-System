from __future__ import annotations

import json
import logging
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from importlib import import_module
from typing import Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import config
from schemas import Action, ABVariant, DecisionEvent, ExecutionResult, ManualReviewResolution, ManualReviewRequest, StepUpRequest

try:
    _prom = import_module("prometheus_client")
    Counter = _prom.Counter
    Gauge = _prom.Gauge
    Histogram = _prom.Histogram
    make_asgi_app = _prom.make_asgi_app
    start_http_server = _prom.start_http_server
except Exception:
    class _NoOpMetric:
        def labels(self, **kwargs): return self
        def inc(self, value=1): return None
        def set(self, value): return None
        def observe(self, value): return None

    Counter = Gauge = Histogram = _NoOpMetric

    def make_asgi_app():
        async def _app(scope, receive, send):
            if scope.get("type") != "http":
                return
            await send({"type": "http.response.start", "status": 200, "headers": [(b"content-type", b"text/plain; charset=utf-8")]})
            await send({"type": "http.response.body", "body": b"# prometheus_client unavailable\n"})

        return _app

    def start_http_server(*args, **kwargs):
        return None

logging.basicConfig(
    level=getattr(logging, config.log_level.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("action_engine")

EVENTS_TOTAL = Counter("action_engine_events_total", "Action engine events", ["action", "status"])
QUEUE_DEPTH = Gauge("action_engine_queue_depth", "Manual review queue depth")
LATENCY_MS = Histogram("action_engine_latency_ms", "Action execution latency (ms)", buckets=[1, 2, 5, 10, 20, 50, 100, 200])


class ActionEngine:
    def __init__(self):
        self._manual_queue: List[Dict] = []
        self._lock = threading.Lock()
        self._producer = None
        self._consumer = None
        self._audit_conn = None

    def connect(self):
        self._connect_kafka()
        self._connect_postgres()

    def _connect_kafka(self):
        if not config.kafka_enabled:
            return
        try:
            kafka = import_module("confluent_kafka")
            Producer = kafka.Producer
            self._producer = Producer({"bootstrap.servers": config.kafka_bootstrap_servers, "acks": "1"})
            logger.info("Kafka producer ready")
        except Exception as exc:
            logger.warning("Kafka producer unavailable: %s", exc)
            self._producer = None

    def _connect_postgres(self):
        if not config.postgres_enabled:
            return
        try:
            psycopg2 = import_module("psycopg2")
            self._audit_conn = psycopg2.connect(config.postgres_dsn)
            self._audit_conn.autocommit = True
            logger.info("PostgreSQL audit connection ready")
        except Exception as exc:
            logger.warning("PostgreSQL audit unavailable: %s", exc)
            self._audit_conn = None

    def _audit(self, event_type: str, payload: Dict):
        if not self._audit_conn:
            return
        try:
            cur = self._audit_conn.cursor()
            cur.execute(
                """
                INSERT INTO audit.events (event_type, entity_type, entity_id, actor, payload)
                VALUES (%s, %s, gen_random_uuid(), %s, %s::jsonb)
                """,
                (event_type, "ACTION_PIPELINE", "action-engine", json.dumps(payload)),
            )
        except Exception as exc:
            logger.debug("Audit write failed: %s", exc)

    def _publish(self, topic: str, payload: Dict):
        if not self._producer:
            return
        try:
            self._producer.produce(topic=topic, key=payload.get("txn_id", "").encode(), value=json.dumps(payload).encode())
            self._producer.poll(0)
        except Exception as exc:
            logger.debug("Kafka publish failed: %s", exc)

    def _queue_review(self, payload: Dict) -> ExecutionResult:
        item = {
            "txn_id": payload["txn_id"],
            "customer_id": payload["customer_id"],
            "priority": int(payload.get("priority", 0)),
            "reason": payload.get("reason", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        with self._lock:
            self._manual_queue.append(item)
            self._manual_queue.sort(key=lambda x: x["priority"], reverse=True)
            QUEUE_DEPTH.set(len(self._manual_queue))
        self._publish(config.kafka_topic_review, item)
        self._audit("MANUAL_REVIEW_QUEUED", item)
        EVENTS_TOTAL.labels(action=Action.MANUAL_REVIEW.value, status="queued").inc()
        return ExecutionResult(
            txn_id=payload["txn_id"],
            customer_id=payload["customer_id"],
            action=Action.MANUAL_REVIEW,
            status="queued",
            outcome="manual_review",
            details={"queue_size": str(len(self._manual_queue))},
        )

    def execute(self, decision: DecisionEvent | Dict) -> ExecutionResult:
        started = time.perf_counter()
        event = decision if isinstance(decision, dict) else decision.model_dump()
        parsed = DecisionEvent(**event)

        shadow_action = parsed.ab_shadow_action
        if shadow_action is not None:
            self._audit(
                "AB_SHADOW_EVALUATION",
                {
                    "txn_id": parsed.txn_id,
                    "customer_id": parsed.customer_id,
                    "executed_action": parsed.action.value,
                    "shadow_action": shadow_action.value,
                    "ab_variant": parsed.ab_variant.value,
                },
            )

        if parsed.action == Action.MANUAL_REVIEW:
            result = self._queue_review({"txn_id": parsed.txn_id, "customer_id": parsed.customer_id, "reason": parsed.explanation.get("decision", "")})
            LATENCY_MS.observe((time.perf_counter() - started) * 1000)
            return result

        if parsed.action == Action.STEP_UP_AUTH:
            outcome = "challenge_issued" if parsed.trust_score >= 0.35 else "challenge_required"
            details = {"channel": "otp" if parsed.trust_score >= 0.35 else "biometric"}
            payload = {"txn_id": parsed.txn_id, "customer_id": parsed.customer_id, "action": parsed.action.value, "outcome": outcome, "details": details}
            self._publish(config.kafka_topic_stepup, payload)
            self._audit("STEP_UP_ISSUED", payload)
            EVENTS_TOTAL.labels(action=parsed.action.value, status=outcome).inc()
            LATENCY_MS.observe((time.perf_counter() - started) * 1000)
            return ExecutionResult(
                txn_id=parsed.txn_id,
                customer_id=parsed.customer_id,
                action=parsed.action,
                status="issued",
                outcome=outcome,
                shadow_action=shadow_action,
                details=details,
            )

        topic = config.kafka_topic_approve if parsed.action == Action.APPROVE else config.kafka_topic_block
        status = "executed"
        outcome = parsed.action.value.lower()
        payload = {"txn_id": parsed.txn_id, "customer_id": parsed.customer_id, "action": parsed.action.value, "outcome": outcome}
        self._publish(topic, payload)
        self._audit("ACTION_EXECUTED", payload)
        EVENTS_TOTAL.labels(action=parsed.action.value, status=status).inc()
        LATENCY_MS.observe((time.perf_counter() - started) * 1000)
        return ExecutionResult(
            txn_id=parsed.txn_id,
            customer_id=parsed.customer_id,
            action=parsed.action,
            status=status,
            outcome=outcome,
            shadow_action=shadow_action,
            details={"topic": topic},
        )

    def step_up(self, req: StepUpRequest) -> ExecutionResult:
        if req.passcode is not None and req.passcode.strip():
            outcome = "challenge_passed"
            action = Action.APPROVE
        else:
            outcome = "challenge_failed"
            action = Action.BLOCK
        payload = {"txn_id": req.txn_id, "customer_id": req.customer_id, "channel": req.challenge_channel, "outcome": outcome}
        self._publish(config.kafka_topic_stepup, payload)
        self._audit("STEP_UP_RESOLVED", payload)
        EVENTS_TOTAL.labels(action=Action.STEP_UP_AUTH.value, status=outcome).inc()
        return ExecutionResult(
            txn_id=req.txn_id,
            customer_id=req.customer_id,
            action=Action.STEP_UP_AUTH,
            status="resolved",
            outcome=outcome,
            details={"final_action": action.value, "channel": req.challenge_channel},
        )

    def manual_review(self, req: ManualReviewRequest) -> ExecutionResult:
        return self._queue_review(req.model_dump())

    def resolve_review(self, txn_id: str, resolution: ManualReviewResolution) -> ExecutionResult:
        with self._lock:
            item = next((x for x in self._manual_queue if x["txn_id"] == txn_id), None)
            if item is None:
                raise KeyError(txn_id)
            self._manual_queue = [x for x in self._manual_queue if x["txn_id"] != txn_id]
            QUEUE_DEPTH.set(len(self._manual_queue))

        label_payload = {
            "txn_id": txn_id,
            "customer_id": item["customer_id"],
            "label": resolution.label,
            "analyst_id": resolution.analyst_id,
            "confidence": resolution.confidence,
            "notes": resolution.notes,
            "labeled_at": datetime.now(timezone.utc).isoformat(),
        }
        self._publish(config.kafka_topic_label, label_payload)
        self._audit("MANUAL_REVIEW_RESOLVED", label_payload)
        EVENTS_TOTAL.labels(action=Action.MANUAL_REVIEW.value, status="resolved").inc()
        return ExecutionResult(
            txn_id=txn_id,
            customer_id=item["customer_id"],
            action=Action.MANUAL_REVIEW,
            status="resolved",
            outcome=resolution.label.lower(),
            details={"analyst_id": resolution.analyst_id},
        )

    def queue(self) -> List[Dict]:
        with self._lock:
            return list(self._manual_queue)


ENGINE = ActionEngine()


def _consume_loop(stop_event: threading.Event):
    try:
        kafka = import_module("confluent_kafka")
        Consumer = kafka.Consumer
    except Exception as exc:
        logger.warning("Kafka consumer unavailable: %s", exc)
        return

    consumer = Consumer({
        "bootstrap.servers": config.kafka_bootstrap_servers,
        "group.id": config.kafka_consumer_group,
        "auto.offset.reset": config.kafka_auto_offset_reset,
        "enable.auto.commit": False,
    })
    consumer.subscribe([config.kafka_topic_decisions])
    logger.info("Action engine consuming from %s", config.kafka_topic_decisions)

    while not stop_event.is_set():
        msg = consumer.poll(0.5)
        if msg is None or msg.error():
            continue
        try:
            event = json.loads(msg.value().decode())
            ENGINE.execute(event)
            consumer.commit(msg, asynchronous=False)
        except Exception as exc:
            logger.warning("Action-engine consume error: %s", exc)

    consumer.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    ENGINE.connect()
    stop_event = threading.Event()
    thread = threading.Thread(target=_consume_loop, args=(stop_event,), daemon=True, name="action-engine-kafka")
    thread.start()
    app.state.stop_event = stop_event
    app.state.thread = thread
    yield
    stop_event.set()
    thread.join(timeout=10)


app = FastAPI(title="Action Engine", version=config.service_version, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"], allow_headers=["*"])
app.mount("/metrics", make_asgi_app())


@app.get("/health")
async def health():
    return {"status": "ok", "service": config.service_name}


@app.get("/ready")
async def ready():
    return {"ready": True, "queue_depth": len(ENGINE.queue())}


@app.get("/queue")
async def queue():
    return {"items": ENGINE.queue(), "depth": len(ENGINE.queue())}


@app.post("/execute", response_model=ExecutionResult)
async def execute(decision: DecisionEvent):
    return ENGINE.execute(decision)


@app.post("/step-up", response_model=ExecutionResult)
async def step_up(req: StepUpRequest):
    return ENGINE.step_up(req)


@app.post("/manual-review", response_model=ExecutionResult)
async def manual_review(req: ManualReviewRequest):
    return ENGINE.manual_review(req)


@app.post("/manual-review/{txn_id}/resolve", response_model=ExecutionResult)
async def resolve_review(txn_id: str, resolution: ManualReviewResolution):
    try:
        return ENGINE.resolve_review(txn_id, resolution)
    except KeyError:
        raise HTTPException(status_code=404, detail="Review item not found")


if __name__ == "__main__":
    start_http_server(config.metrics_port)
    uvicorn.run("main:app", host=config.host, port=config.port, workers=1, log_level=config.log_level.lower())
