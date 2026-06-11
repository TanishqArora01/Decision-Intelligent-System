"""
anomaly/anomaly_scorer.py
Wraps trained anomaly detectors for Stage 2 scoring.
"""
from __future__ import annotations

import numpy as np

from anomaly.detectors import AnomalyDetector, AnomalyTrainer
from schemas import AnomalyResult


class AnomalyScorer:
    def __init__(self, detector: AnomalyDetector):
        self.detector = detector
        self.ae = detector.ae
        self.iforest = detector.iforest

    def score(self, X: np.ndarray) -> AnomalyResult:
        combined, ae_s, if_s = self.detector.score(X)
        return AnomalyResult(
            anomaly_score=combined,
            autoencoder_score=ae_s,
            isolation_forest_score=if_s,
            is_anomaly=combined >= 0.6,
        )


def build_anomaly_scorer(X: np.ndarray, y: np.ndarray) -> AnomalyScorer:
    """Train on legitimate rows only; fraud rows define the normal manifold boundary."""
    legit_mask = y == 0
    X_legit = X[legit_mask] if legit_mask.any() else X
    ae_art, if_art = AnomalyTrainer().train(X_legit)
    return AnomalyScorer(AnomalyDetector(ae_art, if_art))
