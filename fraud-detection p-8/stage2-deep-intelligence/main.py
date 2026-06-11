"""main.py — Stage 2 Deep Intelligence service.

This entrypoint now delegates to the predictor orchestrator, which already
combines XGBoost, MLP, Neo4j graph features, and anomaly detection.
It also exposes a reload endpoint so the retraining DAG can deploy new
models without a container restart.
"""
from __future__ import annotations

import json
import logging
import threading
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app, start_http_server

from config import config
from predictor import build_predictor
from routes.health import router as health_router
from routes.predict import router as predict_router

logging.basicConfig(
    level=getattr(logging, config.log_level.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("stage2.main")


class KafkaConsumerThread(threading.Thread):
    def __init__(self, engine_provider, stop_event: threading.Event):
        super().__init__(name="stage2-kafka", daemon=True)
        self.engine_provider = engine_provider
        self.stop_event = stop_event
        self._consumer = None
        self._producer = None

    def _connect(self):
        try:
            from confluent_kafka import Consumer, Producer

            self._consumer = Consumer({
                "bootstrap.servers": config.kafka_bootstrap_servers,
                "group.id": config.kafka_consumer_group,
                "auto.offset.reset": config.kafka_auto_offset_reset,
                "enable.auto.commit": False,
            })
            self._consumer.subscribe([config.kafka_topic_stage1])
            self._producer = Producer({
                "bootstrap.servers": config.kafka_bootstrap_servers,
                "acks": "1",
                "linger.ms": "5",
            })
            logger.info("Stage 2 Kafka consumer started | group=%s", config.kafka_consumer_group)
            return True
        except Exception as exc:
            logger.warning("Kafka unavailable (non-fatal): %s", exc)
            return False

    def run(self):
        if not config.kafka_enabled or not self._connect():
            return

        while not self.stop_event.is_set():
            try:
                msg = self._consumer.poll(timeout=0.5)
                if msg is None or msg.error():
                    continue
                raw = json.loads(msg.value().decode())
                from schemas import Stage2Request

                req = Stage2Request(**raw)
                engine = self.engine_provider()
                resp = engine.score(req)
                self._producer.produce(
                    topic=config.kafka_topic_stage2,
                    key=req.customer_id.encode(),
                    value=resp.model_dump_json().encode(),
                )
                self._producer.poll(0)
                self._consumer.commit(msg, asynchronous=False)
            except Exception as exc:
                logger.warning("Stage 2 Kafka loop error: %s", exc)

        if self._consumer:
            self._consumer.close()
        if self._producer:
            self._producer.flush(5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("Stage 2 — Deep Intelligence Service")
    logger.info("=" * 60)

    engine = build_predictor(_make_neo4j_client())
    app.state.engine = engine
    app.state.neo4j = getattr(engine, "neo4j", None)

    try:
        start_http_server(config.metrics_port)
        logger.info("Prometheus metrics at http://0.0.0.0:%d/metrics", config.metrics_port)
    except Exception as exc:
        logger.warning("Prometheus server failed to start: %s", exc)

    stop_event = threading.Event()
    kafka_thread = KafkaConsumerThread(lambda: app.state.engine, stop_event)
    kafka_thread.start()
    app.state.kafka_stop = stop_event
    app.state.kafka_thread = kafka_thread

    logger.info("Stage 2 engine ready.")
    yield

    stop_event.set()
    kafka_thread.join(timeout=10)
    neo4j = getattr(app.state, "neo4j", None)
    if neo4j is not None:
        neo4j.close()


def _make_neo4j_client():
    from graph.neo4j_client import Neo4jClient

    neo4j = Neo4jClient()
    neo4j.connect()
    return neo4j


app = FastAPI(
    title="Stage 2 — Deep Intelligence",
    version=config.service_version,
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"], allow_headers=["*"])
app.include_router(predict_router, tags=["Prediction"])
app.include_router(health_router, tags=["Operations"])
app.mount("/metrics", make_asgi_app())


@app.post("/reload-models", summary="Reload Stage 2 models and graph client")
async def reload_models():
    old_neo4j = getattr(app.state, "neo4j", None)
    if old_neo4j is not None:
        try:
            old_neo4j.close()
        except Exception:
            pass
    app.state.engine = build_predictor(_make_neo4j_client())
    app.state.neo4j = getattr(app.state.engine, "neo4j", None)
    return {
        "reloaded": True,
        "xgb_version": app.state.engine.xgb.version,
        "mlp_version": app.state.engine.mlp.version,
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host=config.host, port=config.port, workers=1, log_level=config.log_level.lower())
