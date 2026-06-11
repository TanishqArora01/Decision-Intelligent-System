"""routes/health.py — Liveness and readiness probes."""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from config import config

router = APIRouter()

@router.get("/health")
async def health():
    return {"status": "ok", "service": config.service_name}

@router.get("/ready")
async def ready(request: Request):
    engine = getattr(request.app.state, "engine", None)
    if engine is None:
        return JSONResponse(status_code=503, content={"ready": False})
    graph_available = False
    if hasattr(engine, "neo4j"):
        graph_available = bool(getattr(engine.neo4j, "available", False))
    elif hasattr(engine, "graph_scorer"):
        graph_available = bool(getattr(engine.graph_scorer.client, "available", False))
    return {"ready": True, "graph_available": graph_available}

@router.get("/model-info")
async def model_info(request: Request):
    engine = getattr(request.app.state, "engine", None)
    if engine is None:
        return JSONResponse(status_code=503, content={"error": "not loaded"})
    graph_available = False
    if hasattr(engine, "neo4j"):
        graph_available = bool(getattr(engine.neo4j, "available", False))
    elif hasattr(engine, "graph_scorer"):
        graph_available = bool(getattr(engine.graph_scorer.client, "available", False))
    return {
        "xgb_version":    engine.xgb.version,
        "mlp_version":    engine.mlp.version,
        "ae_version":     engine.anomaly.ae.version,
        "iforest_version":engine.anomaly.iforest.version,
        "graph_available": graph_available,
        "neo4j_uri":      config.neo4j_uri,
        "feature_count":  len(config.feature_names),
    }
