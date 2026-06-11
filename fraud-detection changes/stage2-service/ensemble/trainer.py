"""
ensemble/trainer.py
Synthetic data generation and model loading for Stage 2.
"""
from __future__ import annotations

import logging
from typing import Tuple

import numpy as np

from config import config
from ensemble.mlp_model import MLPArtifact, MLPTrainer, load_mlp_from_mlflow
from ensemble.xgboost_model import XGBoostArtifact, XGBoostTrainer, load_xgb_from_mlflow

logger = logging.getLogger(__name__)


class SyntheticDataGenerator:
    """Generates synthetic 18-feature training data (same schema as Stage 1)."""

    def __init__(self, rng: np.random.RandomState):
        self.rng = rng

    def generate(self, n_samples: int, fraud_rate: float) -> Tuple[np.ndarray, np.ndarray]:
        n_fraud = int(n_samples * fraud_rate)
        n_legit = n_samples - n_fraud
        X = np.vstack([self._generate_legitimate(n_legit), self._generate_fraud(n_fraud)])
        y = np.concatenate([np.zeros(n_legit), np.ones(n_fraud)])
        idx = self.rng.permutation(len(y))
        return X[idx], y[idx]

    def _generate_legitimate(self, n: int) -> np.ndarray:
        r = self.rng
        rows = []
        for _ in range(n):
            txn_c1m = r.poisson(0.3)
            txn_c5m = txn_c1m + r.poisson(0.8)
            txn_c1h = txn_c5m + r.poisson(2.0)
            txn_c24h = txn_c1h + r.poisson(5.0)
            base_amt = r.lognormal(4.5, 0.8)
            rows.append([
                txn_c1m, txn_c5m, txn_c1h, txn_c24h,
                base_amt * txn_c1m, base_amt * txn_c5m, base_amt * txn_c1h, base_amt * txn_c24h,
                r.exponential(15), float(r.random() < 0.03), 1 + r.poisson(0.1),
                r.uniform(0.5, 1.0), float(r.random() < 0.05), r.poisson(2), 1 + r.poisson(0.3),
                r.lognormal(0.0, 0.4), r.uniform(0.4, 1.0), r.exponential(12),
            ])
        return np.array(rows, dtype=np.float32)

    def _generate_fraud(self, n: int) -> np.ndarray:
        r = self.rng
        patterns = ["card_testing", "account_takeover", "velocity_attack", "large_amount"]
        weights = [0.25, 0.25, 0.25, 0.25]
        pattern_idx = r.choice(len(patterns), size=n, p=weights)
        return np.array([self._fraud_pattern(patterns[i]) for i in pattern_idx], dtype=np.float32)

    def _fraud_pattern(self, pattern: str) -> list:
        r = self.rng
        if pattern == "card_testing":
            cnt = r.randint(5, 15)
            return [
                cnt, cnt, cnt + r.randint(0, 3), cnt + r.randint(2, 8),
                cnt * r.uniform(0.5, 4.0), cnt * r.uniform(0.5, 4.0),
                cnt * r.uniform(0.5, 4.0), cnt * r.uniform(1.0, 8.0),
                r.uniform(0, 50), float(r.random() < 0.3), 1 + r.poisson(0.2),
                0.0, True, r.poisson(15), 1,
                r.uniform(0.01, 0.1), 0.0, r.uniform(0, 2),
            ]
        if pattern == "account_takeover":
            return [
                r.poisson(0.5), r.poisson(1), r.poisson(2), r.poisson(6),
                0, r.uniform(100, 500), r.uniform(500, 2000), r.uniform(1000, 5000),
                r.uniform(3000, 15000), True, r.randint(2, 4),
                0.0, True, r.poisson(3), 1,
                r.uniform(5, 20), 0.0, r.uniform(1, 168),
            ]
        if pattern == "velocity_attack":
            cnt = r.randint(8, 25)
            avg = r.uniform(100, 500)
            return [
                cnt, cnt + r.randint(2, 5), cnt + r.randint(5, 10), cnt + r.randint(10, 20),
                cnt * avg, cnt * avg, cnt * avg, cnt * avg * 1.2,
                r.uniform(0, 30), float(r.random() < 0.2), 1 + r.poisson(0.3),
                r.uniform(0.0, 0.4), float(r.random() < 0.5), r.poisson(20), 1 + r.poisson(0.5),
                r.uniform(2, 6), 0.0, r.uniform(0, 1),
            ]
        cnt = r.poisson(0.3)
        return [
            cnt, r.poisson(0.8), r.poisson(2), r.poisson(5),
            0, r.uniform(100, 500), r.uniform(500, 2000), r.uniform(1000, 5000),
            r.uniform(0, 200), float(r.random() < 0.1), 1 + r.poisson(0.1),
            r.uniform(0.0, 0.6), float(r.random() < 0.4), r.poisson(3), 1 + r.poisson(0.2),
            r.uniform(10, 50), r.uniform(0, 0.2), r.uniform(1, 720),
        ]


class XGBoostModel:
    def __init__(self, artifact: XGBoostArtifact):
        self._artifact = artifact
        self.model_version = artifact.version

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return self._artifact.predict_proba(X)

    def top_shap_features(self, X: np.ndarray, top_n: int = 3) -> dict:
        try:
            imp = self._artifact.booster.get_score(importance_type="gain")
            pairs = []
            for i, name in enumerate(config.feature_names):
                val = imp.get(name, imp.get(f"f{i}", 0.0))
                pairs.append((name, float(val)))
            pairs.sort(key=lambda x: -x[1])
            return {k: v for k, v in pairs[:top_n]}
        except Exception:
            return {name: 0.0 for name in config.feature_names[:top_n]}


class MLPModel:
    def __init__(self, artifact: MLPArtifact):
        self._artifact = artifact
        self.model_version = artifact.version

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return self._artifact.predict_proba(X)


def build_models() -> Tuple[XGBoostModel, MLPModel]:
    rng = np.random.RandomState(config.random_seed)
    gen = SyntheticDataGenerator(rng)
    X, y = gen.generate(config.train_samples, config.train_fraud_rate)

    xgb_art = load_xgb_from_mlflow()
    if xgb_art is None:
        logger.info("Training XGBoost (no MLflow model found)...")
        xgb_art = XGBoostTrainer().train(X, y)

    mlp_art = load_mlp_from_mlflow()
    if mlp_art is None:
        logger.info("Training MLP (no MLflow model found)...")
        mlp_art = MLPTrainer().train(X, y)

    return XGBoostModel(xgb_art), MLPModel(mlp_art)
