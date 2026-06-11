"""
ensemble/fusion.py
Weighted score fusion for Stage 2 ensemble.
Combines XGBoost, MLP, Anomaly, and Graph scores into a final P(fraud).
"""
from __future__ import annotations
import logging
from typing import Dict, Tuple
import numpy as np
from config import config
logger = logging.getLogger(__name__)


class EnsembleFusion:

    def __init__(self):
        self.weights = {
            "xgb":     config.ensemble_xgb_weight,
            "mlp":     config.ensemble_mlp_weight,
            "anomaly": config.ensemble_anomaly_weight,
            "graph":   config.ensemble_graph_weight,
        }

    def fuse(self, xgb_score: float, mlp_score: float,
             anomaly_score: float, graph_score: float,
             graph_available: bool = True) -> Tuple[float, float, Dict[str, float]]:
        """
        Fuse component scores. Redistributes weight if graph unavailable.
        Returns (fused_p_fraud, confidence, component_scores_dict).
        """
        scores = {
            "xgb":     float(np.clip(xgb_score,     0.0, 1.0)),
            "mlp":     float(np.clip(mlp_score,     0.0, 1.0)),
            "anomaly": float(np.clip(anomaly_score, 0.0, 1.0)),
        }
        if graph_available:
            scores["graph"] = float(np.clip(graph_score, 0.0, 1.0))
            active = dict(self.weights)
        else:
            active = {k: v for k, v in self.weights.items() if k != "graph"}

        total_w = sum(active.values())
        norm_w  = {k: v / total_w for k, v in active.items()}

        fused  = float(np.clip(sum(norm_w[k] * scores[k] for k in active), 0.0, 1.0))
        spread = float(np.std([scores[k] for k in active]))
        confidence = float(np.clip(1.0 - spread * 2.0, 0.0, 1.0))

        return fused, confidence, {k: round(v, 5) for k, v in scores.items()}

    def build_explanation(
        self, p_fraud: float, xgb_score: float, mlp_score: float,
        anomaly_score: float, graph_risk, top_features: Dict[str, float],
    ) -> Dict[str, str]:
        """Build human-readable explanation for Stage 2 decision."""
        expl: Dict[str, str] = {}
        if xgb_score > 0.7:
            expl["xgboost"] = f"XGBoost flags high risk ({xgb_score:.2f})"
        if mlp_score > 0.7:
            expl["mlp"] = f"Neural network confirms elevated risk ({mlp_score:.2f})"
        if anomaly_score > 0.6:
            expl["anomaly"] = f"Unusual transaction pattern (anomaly score: {anomaly_score:.2f})"
        if getattr(graph_risk, 'fraud_ring_score', 0) > 0.5:
            devs = ", ".join(getattr(graph_risk,'shared_devices',[])[:3])
            expl["fraud_ring"] = f"Shares device(s) [{devs}] with other flagged customers"
        if getattr(graph_risk, 'mule_account_score', 0) > 0.5:
            expl["mule_account"] = "High inbound transaction volume consistent with mule activity"
        if getattr(graph_risk, 'synthetic_identity_score', 0) > 0.5:
            expl["synthetic_identity"] = "Account age vs activity inconsistent with real customer"
        if getattr(graph_risk, 'velocity_graph_score', 0) > 0.5:
            expl["velocity_burst"] = "Burst of transaction edges detected in short window"
        if getattr(graph_risk, 'multi_hop_score', 0) > 0.5:
            summary = getattr(graph_risk,'hop_path_summary','')
            expl["multi_hop"] = f"Fraud network connection: {summary}"
        for feat, val in list(top_features.items())[:2]:
            if abs(val) > 0.1:
                direction = "elevated" if val > 0 else "suppressed"
                expl[f"feature_{feat}"] = f"{feat.replace('_',' ').title()} is {direction} (impact: {val:+.3f})"
        if not expl:
            expl["summary"] = f"Ensemble consensus: P(fraud)={p_fraud:.3f}"
        return expl


_fusion = EnsembleFusion()


def fuse_ensemble(
    xgb_score: float, mlp_score: float, w_xgb: float, w_mlp: float
) -> Tuple[float, float]:
    total = w_xgb + w_mlp
    if total <= 0:
        return float(xgb_score), 0.5
    refined = float(np.clip((w_xgb * xgb_score + w_mlp * mlp_score) / total, 0.0, 1.0))
    confidence = float(np.clip(1.0 - abs(xgb_score - mlp_score) * 2.0, 0.0, 1.0))
    return refined, confidence


def fuse_all(
    ensemble_score: float, graph_risk: float, anomaly_score: float
) -> float:
    w_e = config.ensemble_xgb_weight + config.ensemble_mlp_weight
    w_g = config.ensemble_graph_weight
    w_a = config.ensemble_anomaly_weight
    total = w_e + w_g + w_a
    if total <= 0:
        return float(ensemble_score)
    return float(
        np.clip(
            (w_e * ensemble_score + w_g * graph_risk + w_a * anomaly_score) / total,
            0.0,
            1.0,
        )
    )


def build_explanation(
    xgb_score: float,
    mlp_score: float,
    graph_risk_score: float,
    anomaly_score: float,
    top_features: Dict[str, float],
) -> Dict[str, str]:
    p_fraud = fuse_all((xgb_score + mlp_score) / 2.0, graph_risk_score, anomaly_score)

    class _GraphRisk:
        fraud_ring_score = graph_risk_score
        mule_account_score = 0.0
        synthetic_identity_score = 0.0
        velocity_graph_score = 0.0
        multi_hop_score = 0.0
        shared_devices: list = []
        hop_path_summary = ""

    return _fusion.build_explanation(
        p_fraud, xgb_score, mlp_score, anomaly_score, _GraphRisk(), top_features
    )
