"""routers/governance.py — Model governance endpoints (ADMIN/OPS_MANAGER)."""
from __future__ import annotations

import sys
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth.rbac import require_admin, require_ops, get_current_user
from db.postgres import User

router = APIRouter(prefix="/governance", tags=["Model Governance"])

GOVERNANCE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "model-governance")


def _import_governance():
    if GOVERNANCE_PATH not in sys.path:
        sys.path.insert(0, GOVERNANCE_PATH)
    import governance
    return governance


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ApproveRequest(BaseModel):
    model_name:    str
    justification: str
    min_val_auc:   float = 0.90
    max_fnr:       float = 0.15


class RollbackRequest(BaseModel):
    model_name: str
    reason:     str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/approve-model")
async def approve_model(
    req:          ApproveRequest,
    current_user: User = Depends(require_admin),
):
    """
    Approve a Staging model for promotion to Production.
    ADMIN only. Requires justification.
    """
    try:
        gov = _import_governance()
        result = gov.approve_model(gov.ApprovalRequest(
            model_name    = req.model_name,
            approver_id   = current_user.id,
            justification = req.justification,
            min_val_auc   = req.min_val_auc,
            max_fnr       = req.max_fnr,
        ))
        if not result.get("approved"):
            raise HTTPException(400, detail=result.get("reason", "Approval failed"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/model-cards")
async def list_model_cards(current_user: User = Depends(require_ops)):
    """Get model cards for all registered models."""
    try:
        gov    = _import_governance()
        models = ["stage1_lgbm", "stage2_xgboost", "stage2_mlp"]
        cards  = {}
        for m in models:
            try:
                cards[m] = gov.generate_model_card(m)
            except Exception as e:
                cards[m] = {"error": str(e)}
        return {"cards": cards}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/model-cards/{model_name}")
async def get_model_card(
    model_name:   str,
    current_user: User = Depends(require_ops),
):
    try:
        gov = _import_governance()
        return gov.generate_model_card(model_name)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/champion-challenger/{model_name}")
async def champion_challenger(
    model_name:   str,
    current_user: User = Depends(require_ops),
):
    """Compare champion (Production) vs challenger (Staging) for a model."""
    try:
        gov    = _import_governance()
        result = gov.compare_champion_challenger(model_name)
        if not result:
            return {"message": "No champion or challenger found", "model_name": model_name}
        import dataclasses
        return dataclasses.asdict(result)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/rollback")
async def rollback(
    req:          RollbackRequest,
    current_user: User = Depends(require_admin),
):
    """
    Roll back the current Production model to the previous version.
    ADMIN only. Requires reason.
    """
    try:
        gov    = _import_governance()
        result = gov.rollback_model(req.model_name, current_user.id, req.reason)
        if not result.get("success"):
            raise HTTPException(400, detail=result.get("reason", "Rollback failed"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
