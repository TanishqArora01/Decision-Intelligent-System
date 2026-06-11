"""
contracts/kafka_contracts.py
Kafka Topic Data Contracts

Defines the canonical schema for every Kafka topic in the system.
All producers must validate against these schemas before publishing.
All consumers can use these schemas to deserialise safely.

Topic registry:
  txn-raw         → TransactionRawMessage
  txn-enriched    → TransactionEnrichedMessage
  txn-stage1      → Stage1Message
  txn-stage2      → Stage2Message
  decisions       → DecisionMessage
  fraud-labels    → FraudLabelMessage
  labels-confirmed → LabelConfirmedMessage

Usage:
  from contracts.kafka_contracts import TransactionRawMessage, validate_message

  # Validate before publishing
  msg = TransactionRawMessage(**data)
  raw = msg.to_kafka_bytes()

  # Validate on consuming
  msg, ok = validate_message("txn-raw", raw_bytes)
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple, Type

logger = logging.getLogger("contracts")


# ---------------------------------------------------------------------------
# Minimal Pydantic-compatible base (avoids import dependency)
# ---------------------------------------------------------------------------
class ContractBase:
    def __init__(self, **data):
        for name, typ in self.__class__.__annotations__.items():
            default = getattr(self.__class__, name, None)
            val     = data.get(name, default() if callable(default) else default)
            # Coerce basic types
            if val is not None:
                try:
                    if typ == float or typ == Optional[float]:
                        val = float(val) if val is not None else None
                    elif typ == int or typ == Optional[int]:
                        val = int(float(val)) if val is not None else None
                    elif typ == bool:
                        val = bool(val) if not isinstance(val, bool) else val
                    elif typ == str or typ == Optional[str]:
                        val = str(val) if val is not None else None
                except (ValueError, TypeError):
                    pass
            setattr(self, name, val)

    def to_dict(self) -> dict:
        return {k: getattr(self, k) for k in self.__class__.__annotations__}

    def to_kafka_bytes(self) -> bytes:
        return json.dumps(self.to_dict(), default=str).encode()

    @classmethod
    def from_bytes(cls, data: bytes):
        return cls(**json.loads(data.decode()))


# ---------------------------------------------------------------------------
# Topic schemas
# ---------------------------------------------------------------------------

class TransactionRawMessage(ContractBase):
    """txn-raw — emitted by all transaction adapters."""
    txn_id:           str
    customer_id:      str
    amount:           float
    currency:         str   = "USD"
    channel:          str   = ""
    merchant_id:      str   = ""
    merchant_category:str   = ""
    device_id:        str   = ""
    ip_address:       str   = ""
    is_new_device:    bool  = False
    country_code:     str   = ""
    city:             str   = ""
    lat:              float = 0.0
    lng:              float = 0.0
    txn_ts:           str   = ""
    clv:              float = 0.0
    trust_score:      float = 0.5
    account_age_days: int   = 0
    customer_segment: str   = "standard"
    adapter_source:   str   = ""

    REQUIRED = {"txn_id", "customer_id", "amount"}


class TransactionEnrichedMessage(ContractBase):
    """txn-enriched — emitted by feature-engine, consumed by Stage 1."""
    txn_id:           str
    customer_id:      str
    amount:           float
    currency:         str   = "USD"
    channel:          str   = ""
    # 18 features
    txn_count_1m:     float = 0.0
    txn_count_5m:     float = 0.0
    txn_count_1h:     float = 0.0
    txn_count_24h:    float = 0.0
    amount_sum_1m:    float = 0.0
    amount_sum_5m:    float = 0.0
    amount_sum_1h:    float = 0.0
    amount_sum_24h:   float = 0.0
    geo_velocity_kmh: float = 0.0
    is_new_country:   bool  = False
    unique_countries_24h:float = 1.0
    device_trust_score:float = 0.5
    is_new_device:    bool  = False
    ip_txn_count_1h:  float = 0.0
    unique_devices_24h:float = 1.0
    amount_vs_avg_ratio:float = 1.0
    merchant_familiarity:float = 0.5
    hours_since_last_txn:float = 24.0
    has_cold_start:   bool  = False

    REQUIRED = {"txn_id", "customer_id", "amount"}


class Stage1Message(ContractBase):
    """txn-stage1 — emitted by Stage 1 (routed transactions only, not early exits)."""
    txn_id:             str
    customer_id:        str
    amount:             float
    p_fraud_stage1:     float
    uncertainty_stage1: float
    stage1_routing:     str   = "PASS_TO_STAGE2"
    model_version:      str   = ""
    inference_time_ms:  float = 0.0
    # Pass-through enriched features
    txn_count_1m:       float = 0.0
    txn_count_5m:       float = 0.0
    txn_count_1h:       float = 0.0
    txn_count_24h:      float = 0.0
    amount_sum_1h:      float = 0.0
    amount_sum_24h:     float = 0.0
    geo_velocity_kmh:   float = 0.0
    is_new_country:     bool  = False
    device_trust_score: float = 0.5
    is_new_device:      bool  = False
    ip_txn_count_1h:    float = 0.0
    amount_vs_avg_ratio:float = 1.0

    REQUIRED = {"txn_id", "customer_id", "p_fraud_stage1"}


class Stage2Message(ContractBase):
    """txn-stage2 — emitted by Stage 2, consumed by Stage 3."""
    txn_id:               str
    customer_id:          str
    amount:               float
    currency:             str   = "USD"
    channel:              str   = ""
    merchant_category:    str   = ""
    country_code:         str   = ""
    txn_ts:               str   = ""
    clv:                  float = 0.0
    trust_score:          float = 0.5
    account_age_days:     int   = 0
    customer_segment:     str   = "standard"
    # Stage 1 scores
    p_fraud_stage1:       float = 0.0
    uncertainty_stage1:   float = 0.0
    # Stage 2 scores
    p_fraud:              float = 0.0
    confidence:           float = 0.5
    xgb_score:            float = 0.0
    mlp_score:            float = 0.0
    graph_risk_score:     float = 0.0
    fraud_ring_score:     float = 0.0
    mule_account_score:   float = 0.0
    synthetic_identity_score:float = 0.0
    velocity_graph_score: float = 0.0
    multi_hop_score:      float = 0.0
    anomaly_score:        float = 0.0
    autoencoder_score:    float = 0.0
    isolation_forest_score:float = 0.0
    is_anomaly:           bool  = False
    neo4j_available:      bool  = True
    fallback_tier:        int   = 0

    REQUIRED = {"txn_id", "customer_id", "p_fraud"}


class DecisionMessage(ContractBase):
    """decisions — emitted by Stage 3 / API Gateway."""
    txn_id:           str
    customer_id:      str
    amount:           float
    currency:         str   = "USD"
    action:           str   = ""
    p_fraud:          float = 0.0
    confidence:       float = 0.5
    uncertainty:      float = 0.5
    graph_risk_score: float = 0.0
    anomaly_score:    float = 0.0
    optimal_cost:     float = 0.0
    clv_used:         float = 0.0
    trust_score:      float = 0.5
    expected_loss:    float = 0.0
    model_version:    str   = ""
    ab_experiment_id: str   = ""
    ab_variant:       str   = "control"
    decision_time_ms: float = 0.0
    pipeline_stage:   int   = 3
    fallback_tier:    int   = 0
    gateway_ts:       str   = ""

    VALID_ACTIONS = {"APPROVE", "BLOCK", "STEP_UP_AUTH", "MANUAL_REVIEW"}
    REQUIRED      = {"txn_id", "customer_id", "action", "p_fraud"}


class FraudLabelMessage(ContractBase):
    """fraud-labels — emitted by chargeback_ingestion DAG + analyst labels."""
    txn_id:           str
    customer_id:      str
    true_label:       str   = ""   # "FRAUD" or "LEGITIMATE"
    label_source:     str   = ""   # CHARGEBACK | ANALYST_FRAUD | ANALYST_LEGIT
    confidence:       float = 1.0
    labeled_at:       str   = ""
    model_action:     str   = ""
    model_p_fraud:    float = 0.0
    model_version:    str   = ""
    amount:           float = 0.0
    channel:          str   = ""
    country_code:     str   = ""

    VALID_LABELS   = {"FRAUD", "LEGITIMATE"}
    VALID_SOURCES  = {"CHARGEBACK", "ANALYST_FRAUD", "ANALYST_LEGIT", "SYNTHETIC"}
    REQUIRED       = {"txn_id", "true_label", "label_source"}


class LabelConfirmedMessage(ContractBase):
    """labels-confirmed — emitted by feedback-service."""
    txn_id:        str
    true_label:    str   = ""
    label_source:  str   = ""
    model_version: str   = ""
    fnr:           float = 0.0
    fpr:           float = 0.0
    confirmed_at:  str   = ""

    REQUIRED = {"txn_id", "true_label", "model_version"}


# ---------------------------------------------------------------------------
# Topic registry
# ---------------------------------------------------------------------------
TOPIC_SCHEMAS: Dict[str, Type[ContractBase]] = {
    "txn-raw":           TransactionRawMessage,
    "txn-enriched":      TransactionEnrichedMessage,
    "txn-stage1":        Stage1Message,
    "txn-stage2":        Stage2Message,
    "decisions":         DecisionMessage,
    "fraud-labels":      FraudLabelMessage,
    "labels-confirmed":  LabelConfirmedMessage,
}


def validate_message(
    topic:  str,
    data:   bytes,
) -> Tuple[Optional[ContractBase], bool, str]:
    """
    Deserialise and validate a Kafka message against the topic's schema.

    Returns:
        (message_obj, is_valid, error_message)
    """
    schema_cls = TOPIC_SCHEMAS.get(topic)
    if not schema_cls:
        return None, True, ""   # unknown topic — pass through

    try:
        raw_dict = json.loads(data.decode())
    except Exception as e:
        return None, False, f"JSON decode failed: {e}"

    # Check required fields
    required = getattr(schema_cls, "REQUIRED", set())
    missing  = required - set(raw_dict.keys())
    if missing:
        return None, False, f"Missing required fields: {missing}"

    try:
        msg = schema_cls(**raw_dict)
    except Exception as e:
        return None, False, f"Schema construction failed: {e}"

    # Validate enum fields where applicable
    if hasattr(schema_cls, "VALID_ACTIONS") and hasattr(msg, "action"):
        if msg.action not in schema_cls.VALID_ACTIONS:
            return msg, False, f"Invalid action: {msg.action}"

    if hasattr(schema_cls, "VALID_LABELS") and hasattr(msg, "true_label"):
        if msg.true_label not in schema_cls.VALID_LABELS:
            return msg, False, f"Invalid label: {msg.true_label}"

    return msg, True, ""


def get_schema_summary() -> dict:
    """Return a summary of all registered schemas for documentation."""
    return {
        topic: {
            "schema":   cls.__name__,
            "required": list(getattr(cls, "REQUIRED", set())),
            "fields":   list(cls.__annotations__.keys()),
        }
        for topic, cls in TOPIC_SCHEMAS.items()
    }
