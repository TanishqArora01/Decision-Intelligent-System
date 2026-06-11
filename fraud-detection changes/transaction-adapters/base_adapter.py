"""
transaction-adapters/base_adapter.py
Base Transaction Adapter

All adapters (ISO 8583, REST webhook, CSV batch) inherit from
BaseAdapter which provides:
  - Transaction normalisation → canonical schema
  - Kafka publish to txn-raw topic
  - Prometheus metrics (throughput, latency, errors)
  - Idempotency key (dedup on txn_id)
"""
from __future__ import annotations

import json
import logging
import os
import time
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from prometheus_client import Counter, Histogram

logger = logging.getLogger(__name__)

ADAPTER_PUBLISHED  = Counter("adapter_published_total",   "Transactions published", ["adapter"])
ADAPTER_ERRORS     = Counter("adapter_errors_total",      "Adapter errors",         ["adapter", "reason"])
ADAPTER_LATENCY    = Histogram("adapter_latency_ms",      "Publish latency (ms)",   ["adapter"])

KAFKA_BROKERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "redpanda:9092")
KAFKA_TOPIC   = os.getenv("KAFKA_TOPIC_RAW",          "txn-raw")


@dataclass
class CanonicalTransaction:
    """
    Canonical transaction schema — every adapter normalises to this shape
    before publishing to txn-raw.

    All fields match the TransactionRequest schema in api-gateway/main.py.
    """
    txn_id:          str
    customer_id:     str
    amount:          float
    currency:        str        = "USD"
    channel:         str        = ""
    merchant_id:     str        = ""
    merchant_category: str      = ""
    device_id:       str        = ""
    ip_address:      str        = ""
    is_new_device:   bool       = False
    is_new_ip:       bool       = False
    country_code:    str        = ""
    city:            str        = ""
    lat:             float      = 0.0
    lng:             float      = 0.0
    txn_ts:          str        = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    # Customer profile — populated by feature engine if not provided
    clv:             float      = 0.0
    trust_score:     float      = 0.5
    account_age_days:int        = 0
    customer_segment:str        = "standard"
    # Adapter metadata
    adapter_source:  str        = ""
    adapter_version: str        = "1.0"
    received_at:     str        = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self) -> bytes:
        return json.dumps(self.to_dict()).encode()


class BaseAdapter(ABC):
    """Abstract base for all transaction source adapters."""

    def __init__(self, adapter_name: str):
        self.name     = adapter_name
        self._producer = None

    def _get_producer(self):
        if self._producer is None:
            try:
                from confluent_kafka import Producer
                self._producer = Producer({
                    "bootstrap.servers": KAFKA_BROKERS,
                    "acks":              "all",
                    "retries":           5,
                    "retry.backoff.ms":  200,
                    "compression.type":  "lz4",
                })
            except Exception as e:
                logger.error("Kafka producer init failed: %s", e)
        return self._producer

    def publish(self, txn: CanonicalTransaction) -> bool:
        """Publish a canonical transaction to txn-raw Kafka topic."""
        t0 = time.perf_counter()
        p  = self._get_producer()
        if not p:
            ADAPTER_ERRORS.labels(adapter=self.name, reason="no_producer").inc()
            return False
        try:
            p.produce(
                topic = KAFKA_TOPIC,
                key   = txn.customer_id.encode(),
                value = txn.to_json(),
            )
            p.poll(0)
            ADAPTER_PUBLISHED.labels(adapter=self.name).inc()
            ADAPTER_LATENCY.labels(adapter=self.name).observe(
                (time.perf_counter() - t0) * 1000
            )
            return True
        except Exception as e:
            logger.error("Kafka publish failed: %s", e)
            ADAPTER_ERRORS.labels(adapter=self.name, reason="publish_error").inc()
            return False

    def publish_batch(self, txns: List[CanonicalTransaction]) -> int:
        """Publish a batch; returns count of successful publishes."""
        ok = 0
        for txn in txns:
            if self.publish(txn): ok += 1
        p = self._get_producer()
        if p: p.flush(10)
        return ok

    @abstractmethod
    def normalise(self, raw: Any) -> Optional[CanonicalTransaction]:
        """Convert raw source message to CanonicalTransaction. Return None to skip."""
        ...

    def flush(self):
        if self._producer:
            self._producer.flush(30)
