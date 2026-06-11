from __future__ import annotations

from enum import Enum
from typing import Dict, Optional

from pydantic import BaseModel, Field


class Action(str, Enum):
    APPROVE = "APPROVE"
    BLOCK = "BLOCK"
    STEP_UP_AUTH = "STEP_UP_AUTH"
    MANUAL_REVIEW = "MANUAL_REVIEW"


class ABVariant(str, Enum):
    CONTROL = "control"
    TREATMENT = "treatment"
    SHADOW = "shadow"


class DecisionEvent(BaseModel):
    txn_id: str
    customer_id: str
    action: Action
    p_fraud: float = 0.0
    uncertainty: float = 0.0
    trust_score: float = 0.5
    graph_risk_score: float = 0.0
    anomaly_score: float = 0.0
    ab_variant: ABVariant = ABVariant.CONTROL
    ab_shadow_action: Optional[Action] = None
    explanation: Dict[str, str] = Field(default_factory=dict)
    model_version: str = ""
    pipeline_stage: int = 3


class ManualReviewRequest(BaseModel):
    txn_id: str
    customer_id: str
    reason: str = ""
    priority: int = 0


class ManualReviewResolution(BaseModel):
    analyst_id: str
    label: str = Field(pattern="^(FRAUD|LEGITIMATE|UNCERTAIN)$")
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    notes: str = ""


class StepUpRequest(BaseModel):
    txn_id: str
    customer_id: str
    trust_score: float = 0.5
    challenge_channel: str = "otp"
    passcode: Optional[str] = None


class ExecutionResult(BaseModel):
    txn_id: str
    customer_id: str
    action: Action
    status: str
    outcome: str
    shadow_action: Optional[Action] = None
    details: Dict[str, str] = Field(default_factory=dict)
