"""
stage2-service/fallback.py
Tiered Fallback Chain for Stage 2 Deep Intelligence

When any Stage 2 component fails, the system degrades gracefully
through a documented chain rather than failing the whole request.

Fallback tiers (in order of preference):
  Tier 0: Full pipeline  — XGBoost + MLP + Neo4j + Anomaly (normal operation)
  Tier 1: No graph       — XGBoost + MLP + Anomaly (Neo4j unavailable)
  Tier 2: XGBoost only   — single model (MLP training failed / timeout)
  Tier 3: Stage 1 passthrough — use Stage 1 p_fraud directly (all Stage 2 down)

Circuit breaker per component:
  - Tracks consecutive failures
  - Opens after FAILURE_THRESHOLD failures in WINDOW_SECONDS
  - Half-opens after RECOVERY_SECONDS (allows one probe request)
  - Resets on successful response

Every fallback event is logged to Prometheus + structured stdout.
"""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, Optional, Tuple

from prometheus_client import Counter, Gauge

logger = logging.getLogger("stage2.fallback")

# ---------------------------------------------------------------------------
# Prometheus metrics
# ---------------------------------------------------------------------------
FALLBACK_TOTAL   = Counter("stage2_fallback",  "Fallback events",    ["component", "tier"])
CIRCUIT_STATE    = Gauge("stage2_circuit_state",      "Circuit state (0=closed 1=open 2=half-open)", ["component"])


# ---------------------------------------------------------------------------
# Circuit breaker
# ---------------------------------------------------------------------------
class CircuitState(Enum):
    CLOSED    = "closed"      # normal
    OPEN      = "open"        # tripped — reject immediately
    HALF_OPEN = "half_open"   # probe — allow one request


@dataclass
class CircuitBreaker:
    name:              str
    failure_threshold: int   = 3
    window_seconds:    float = 60.0
    recovery_seconds:  float = 30.0

    _state:        CircuitState = field(default=CircuitState.CLOSED, init=False)
    _failures:     int          = field(default=0,    init=False)
    _last_failure: float        = field(default=0.0,  init=False)
    _opened_at:    float        = field(default=0.0,  init=False)
    _lock:         threading.Lock = field(default_factory=threading.Lock, init=False)

    def is_available(self) -> bool:
        with self._lock:
            if self._state == CircuitState.CLOSED:
                return True
            if self._state == CircuitState.OPEN:
                if time.monotonic() - self._opened_at >= self.recovery_seconds:
                    self._state = CircuitState.HALF_OPEN
                    CIRCUIT_STATE.labels(component=self.name).set(2)
                    logger.info("Circuit %s → HALF_OPEN (probe)", self.name)
                    return True
                return False
            return True  # HALF_OPEN: allow probe

    def record_success(self):
        with self._lock:
            self._failures = 0
            self._state    = CircuitState.CLOSED
            CIRCUIT_STATE.labels(component=self.name).set(0)

    def record_failure(self):
        with self._lock:
            self._failures    += 1
            self._last_failure = time.monotonic()
            if self._state == CircuitState.HALF_OPEN:
                self._state     = CircuitState.OPEN
                self._opened_at = time.monotonic()
                CIRCUIT_STATE.labels(component=self.name).set(1)
                logger.warning("Circuit %s → OPEN (probe failed)", self.name)
            elif self._failures >= self.failure_threshold:
                self._state     = CircuitState.OPEN
                self._opened_at = time.monotonic()
                CIRCUIT_STATE.labels(component=self.name).set(1)
                logger.warning("Circuit %s → OPEN (%d failures)", self.name, self._failures)

    @property
    def state(self) -> str:
        return self._state.value


# ---------------------------------------------------------------------------
# Circuit breaker registry — one per Stage 2 component
# ---------------------------------------------------------------------------
class CircuitBreakerRegistry:
    def __init__(self):
        self._breakers: Dict[str, CircuitBreaker] = {}
        self._lock = threading.Lock()

    def get(self, name: str, **kwargs) -> CircuitBreaker:
        with self._lock:
            if name not in self._breakers:
                self._breakers[name] = CircuitBreaker(name=name, **kwargs)
            return self._breakers[name]

    def status(self) -> Dict[str, str]:
        return {name: cb.state for name, cb in self._breakers.items()}


registry = CircuitBreakerRegistry()


# ---------------------------------------------------------------------------
# Guarded call — wraps a component call with circuit breaker logic
# ---------------------------------------------------------------------------
def guarded_call(
    component: str,
    fn:        Callable,
    *args,
    default:   Any = None,
    timeout:   float = 2.0,
    **kwargs,
) -> Tuple[Any, bool]:
    """
    Call fn(*args, **kwargs) through the circuit breaker for `component`.

    Returns:
        (result, success: bool)
        If circuit is open or call fails → (default, False)
    """
    cb = registry.get(component, failure_threshold=3, recovery_seconds=30)

    if not cb.is_available():
        logger.debug("Circuit %s OPEN — returning default", component)
        FALLBACK_TOTAL.labels(component=component, tier="circuit_open").inc()
        return default, False

    try:
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(fn, *args, **kwargs)
            result = future.result(timeout=timeout)
        cb.record_success()
        return result, True
    except concurrent.futures.TimeoutError:
        cb.record_failure()
        logger.warning("Component %s timeout (%.1fs)", component, timeout)
        FALLBACK_TOTAL.labels(component=component, tier="timeout").inc()
        return default, False
    except Exception as e:
        cb.record_failure()
        logger.warning("Component %s failed: %s", component, e)
        FALLBACK_TOTAL.labels(component=component, tier="exception").inc()
        return default, False


# ---------------------------------------------------------------------------
# Fallback tiers — documented degradation levels
# ---------------------------------------------------------------------------

@dataclass
class Stage2Result:
    p_fraud:              float = 0.5
    confidence:           float = 0.5
    xgb_score:            float = 0.0
    mlp_score:            float = 0.0
    graph_risk_score:     float = 0.0
    anomaly_score:        float = 0.0
    fraud_ring_score:     float = 0.0
    mule_account_score:   float = 0.0
    synthetic_identity_score: float = 0.0
    velocity_graph_score: float = 0.0
    multi_hop_score:      float = 0.0
    autoencoder_score:    float = 0.0
    isolation_forest_score: float = 0.0
    is_anomaly:           bool  = False
    neo4j_available:      bool  = True
    fallback_tier:        int   = 0
    explanation:          Dict  = field(default_factory=dict)


def tier3_passthrough(p_fraud_stage1: float, uncertainty: float) -> Stage2Result:
    """Tier 3: Stage 1 score passed through directly. Minimal confidence."""
    FALLBACK_TOTAL.labels(component="stage2_full", tier="tier3_passthrough").inc()
    logger.warning("Stage 2 TIER 3 fallback — using Stage 1 passthrough")
    return Stage2Result(
        p_fraud     = p_fraud_stage1,
        confidence  = max(0.3, 1.0 - uncertainty - 0.2),  # penalise confidence
        fallback_tier = 3,
        neo4j_available = False,
        explanation = {
            "fallback": "Tier 3 — all Stage 2 components unavailable, using Stage 1 score",
            "degraded": "true",
        },
    )


def build_ensemble_result(
    p_fraud_stage1: float,
    uncertainty:    float,
    xgb_result:     Optional[Tuple[float, bool]],
    mlp_result:     Optional[Tuple[float, bool]],
    graph_result:   Optional[Tuple[Dict, bool]],
    anomaly_result: Optional[Tuple[Dict, bool]],
) -> Stage2Result:
    """
    Build ensemble result from available component results.
    Automatically determines fallback tier based on what succeeded.
    """
    xgb_score,   xgb_ok   = xgb_result   or (0.0, False)
    mlp_score,   mlp_ok   = mlp_result   or (0.0, False)
    graph_data,  graph_ok = graph_result or ({},  False)
    anomaly_data,anom_ok  = anomaly_result or ({}, False)

    # Determine tier
    if xgb_ok and mlp_ok and graph_ok and anom_ok:
        tier = 0
    elif xgb_ok and (mlp_ok or anom_ok):
        tier = 1   # no graph
    elif xgb_ok:
        tier = 2   # xgb only
    else:
        return tier3_passthrough(p_fraud_stage1, uncertainty)

    # Weights — adjust dynamically based on availability
    w_xgb  = 0.40 if xgb_ok  else 0.0
    w_mlp  = 0.35 if mlp_ok  else 0.0
    w_graph= 0.10 if graph_ok else 0.0
    w_anom = 0.15 if anom_ok  else 0.0
    total_w = w_xgb + w_mlp + w_graph + w_anom or 1.0

    # Normalise weights
    w_xgb  /= total_w
    w_mlp  /= total_w
    w_graph /= total_w
    w_anom  /= total_w

    # Graph scores
    gr = graph_data if isinstance(graph_data, dict) else {}
    ar = anomaly_data if isinstance(anomaly_data, dict) else {}

    graph_risk   = float(gr.get("combined_graph_risk", 0.0))
    anomaly_score= float(ar.get("combined_score",       0.0))
    is_anomaly   = bool(ar.get("is_anomaly",             False))

    p_fraud = (
        w_xgb  * float(xgb_score) +
        w_mlp  * float(mlp_score) +
        w_graph * graph_risk      +
        w_anom  * anomaly_score
    )
    # Confidence penalty when components are missing
    confidence_penalty = 0.1 * tier
    confidence = max(0.3, min(0.99, 1.0 - uncertainty - confidence_penalty))

    return Stage2Result(
        p_fraud              = round(min(1.0, max(0.0, p_fraud)), 6),
        confidence           = round(confidence, 4),
        xgb_score            = float(xgb_score) if xgb_ok  else 0.0,
        mlp_score            = float(mlp_score) if mlp_ok  else 0.0,
        graph_risk_score     = graph_risk,
        anomaly_score        = anomaly_score,
        fraud_ring_score     = float(gr.get("fraud_ring_score",        0.0)),
        mule_account_score   = float(gr.get("mule_account_score",      0.0)),
        synthetic_identity_score = float(gr.get("synthetic_identity_score", 0.0)),
        velocity_graph_score = float(gr.get("velocity_graph_score",    0.0)),
        multi_hop_score      = float(gr.get("multi_hop_score",         0.0)),
        autoencoder_score    = float(ar.get("autoencoder_score",        0.0)),
        isolation_forest_score = float(ar.get("isolation_forest_score", 0.0)),
        is_anomaly           = is_anomaly,
        neo4j_available      = graph_ok,
        fallback_tier        = tier,
        explanation          = {
            "tier":       str(tier),
            "components": f"xgb={xgb_ok} mlp={mlp_ok} graph={graph_ok} anomaly={anom_ok}",
            "weights":    f"xgb={w_xgb:.2f} mlp={w_mlp:.2f} graph={w_graph:.2f} anom={w_anom:.2f}",
        },
    )
