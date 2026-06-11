"""
transaction-adapters/webhook/adapter.py
REST Webhook Adapter

Exposes a FastAPI endpoint that bank systems can POST transactions to.
Normalises and publishes to txn-raw Kafka topic.

Authentication:
  - HMAC-SHA256 signature verification on X-Signature header
  - API key via X-API-Key header (falls back to HMAC)
  - IP allowlist (configurable via env)

POST /transactions        — single transaction
POST /transactions/batch  — up to 500 transactions
GET  /health              — liveness probe
GET  /stats               — throughput stats
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import time
from typing import Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app
from pydantic import BaseModel, Field

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_adapter import BaseAdapter, CanonicalTransaction

logger = logging.getLogger("adapter.webhook")

WEBHOOK_SECRET  = os.getenv("WEBHOOK_SECRET",  "webhook-secret-2024")
ALLOWED_KEYS    = set(k.strip() for k in os.getenv("API_KEYS", "key-demo-001").split(","))
IP_ALLOWLIST    = set(i.strip() for i in os.getenv("IP_ALLOWLIST", "").split(",") if i.strip())
PORT            = int(os.getenv("WEBHOOK_PORT", "8600"))
MAX_BATCH_SIZE  = int(os.getenv("MAX_BATCH_SIZE", "500"))


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class WebhookTransaction(BaseModel):
    txn_id:           str
    customer_id:      str
    amount:           float = Field(gt=0)
    currency:         str   = "USD"
    channel:          str   = "WEB"
    merchant_id:      str   = ""
    merchant_category:str   = ""
    device_id:        str   = ""
    ip_address:       str   = ""
    is_new_device:    bool  = False
    country_code:     str   = ""
    city:             str   = ""
    lat:              float = 0.0
    lng:              float = 0.0
    txn_ts:           Optional[str] = None
    clv:              float = 0.0
    trust_score:      float = 0.5
    account_age_days: int   = 0
    customer_segment: str   = "standard"


class BatchRequest(BaseModel):
    transactions: List[WebhookTransaction] = Field(max_length=MAX_BATCH_SIZE)
    source_id:    str = ""


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

class WebhookAdapter(BaseAdapter):
    def __init__(self):
        super().__init__("webhook")
        self._stats = {"received": 0, "published": 0, "errors": 0}

    def normalise(self, raw: WebhookTransaction) -> Optional[CanonicalTransaction]:
        from datetime import datetime, timezone
        return CanonicalTransaction(
            txn_id           = raw.txn_id,
            customer_id      = raw.customer_id,
            amount           = raw.amount,
            currency         = raw.currency,
            channel          = raw.channel,
            merchant_id      = raw.merchant_id,
            merchant_category= raw.merchant_category,
            device_id        = raw.device_id,
            ip_address       = raw.ip_address,
            is_new_device    = raw.is_new_device,
            country_code     = raw.country_code,
            city             = raw.city,
            lat              = raw.lat,
            lng              = raw.lng,
            txn_ts           = raw.txn_ts or datetime.now(timezone.utc).isoformat(),
            clv              = raw.clv,
            trust_score      = raw.trust_score,
            account_age_days = raw.account_age_days,
            customer_segment = raw.customer_segment,
            adapter_source   = "webhook",
        )

    def stats(self) -> dict:
        return dict(self._stats)


adapter = WebhookAdapter()


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def verify_hmac(body: bytes, signature: str) -> bool:
    """Verify HMAC-SHA256 signature: X-Signature = hmac(secret, body)."""
    expected = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.lstrip("sha256="))


def authenticate(request: Request, body: bytes = b"") -> None:
    """Raise HTTPException if request is not authenticated."""
    # IP allowlist (if configured)
    if IP_ALLOWLIST:
        client_ip = request.client.host if request.client else ""
        if client_ip not in IP_ALLOWLIST:
            raise HTTPException(403, f"IP {client_ip} not in allowlist")

    # API key
    api_key = request.headers.get("X-API-Key", "")
    if api_key in ALLOWED_KEYS:
        return

    # HMAC signature
    signature = request.headers.get("X-Signature", "")
    if signature and verify_hmac(body, signature):
        return

    raise HTTPException(401, "Authentication required: X-API-Key or X-Signature")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Transaction Webhook Adapter", version="1.0.0")
app.mount("/metrics", make_asgi_app())


@app.post("/transactions")
async def receive_transaction(txn: WebhookTransaction, request: Request):
    body = await request.body()
    authenticate(request, body)
    adapter._stats["received"] += 1

    canonical = adapter.normalise(txn)
    if not canonical:
        adapter._stats["errors"] += 1
        raise HTTPException(400, "Could not normalise transaction")

    ok = adapter.publish(canonical)
    if ok:
        adapter._stats["published"] += 1
        return {"txn_id": txn.txn_id, "status": "queued"}
    else:
        adapter._stats["errors"] += 1
        raise HTTPException(503, "Kafka unavailable — transaction not queued")


@app.post("/transactions/batch")
async def receive_batch(batch: BatchRequest, request: Request):
    body = await request.body()
    authenticate(request, body)

    txns = [adapter.normalise(t) for t in batch.transactions]
    txns = [t for t in txns if t is not None]

    adapter._stats["received"] += len(batch.transactions)
    published = adapter.publish_batch(txns)
    adapter._stats["published"] += published

    return {
        "received":  len(batch.transactions),
        "published": published,
        "failed":    len(batch.transactions) - published,
        "source_id": batch.source_id,
    }


@app.get("/health")
async def health():
    return {"status": "ok", "service": "webhook-adapter"}


@app.get("/stats")
async def stats():
    return adapter.stats()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s | %(levelname)-8s | %(message)s")
    uvicorn.run(app, host="0.0.0.0", port=PORT,
                log_level=os.getenv("LOG_LEVEL", "info").lower())
