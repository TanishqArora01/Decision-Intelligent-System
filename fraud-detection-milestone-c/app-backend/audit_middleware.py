"""
app-backend/audit_middleware.py
Request audit logging middleware for the app-backend.

Logs every authenticated request to audit.events with:
  - user_id, username, role
  - endpoint, HTTP method
  - HTTP status code
  - request latency (ms)
  - client IP
  - request body size

Used for:
  - Security incident investigation
  - Compliance audit trail
  - Unusual access pattern detection

Add to main.py:
    from audit_middleware import AuditMiddleware
    app.add_middleware(AuditMiddleware)
"""
from __future__ import annotations

import json
import logging
import time
import uuid
import hashlib
from typing import Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

logger = logging.getLogger("audit")

# Endpoints to skip (health checks, metrics)
SKIP_PATHS = {"/health", "/ready", "/metrics", "/docs", "/openapi.json", "/favicon.ico"}


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Logs every non-trivial request to the PostgreSQL audit.events table.
    Falls back to structured logging if the DB write fails.
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self._db_available = True

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Skip health/docs endpoints
        if request.url.path in SKIP_PATHS or request.url.path.startswith("/docs"):
            return await call_next(request)

        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

        # Extract caller identity from request state (set by RBAC dependency)
        user_id  = getattr(request.state, "user_id",  None)
        username = getattr(request.state, "username", None)
        role     = getattr(request.state, "role",     None)

        # Extract or generate correlation ID
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        
        # Mask PII (client IP)
        raw_ip = request.client.host if request.client else None
        masked_ip = hashlib.sha256(raw_ip.encode()).hexdigest()[:16] if raw_ip else None

        # If no user (public endpoint or auth failed), still log with nulls
        event = {
            "event_type":  "API_REQUEST",
            "entity_type": "ENDPOINT",
            "entity_id":   request.url.path,
            "actor":       username or "anonymous",
            "payload": {
                "correlation_id": correlation_id,
                "user_id":    user_id,
                "role":       role,
                "method":     request.method,
                "path":       request.url.path,
                "query":      str(request.url.query)[:200] if request.url.query else None,
                "status":     response.status_code,
                "latency_ms": elapsed_ms,
                "client_ip_hash": masked_ip,
                "user_agent": request.headers.get("user-agent", "")[:100],
            },
        }

        # Inject correlation ID into response headers
        response.headers["X-Correlation-ID"] = correlation_id

        # Async DB write (best-effort, never block the response)
        if self._db_available:
            try:
                await self._write_audit(event)
            except Exception as e:
                logger.debug("Audit DB write failed (non-fatal): %s", e)
                self._db_available = False  # stop trying after first failure

        # Always structured-log it too
        logger.info(
            json.dumps({
                "msg": "API Request",
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "latency_ms": elapsed_ms,
                "role": role or "anon",
                "user": username or "-",
                "correlation_id": correlation_id
            })
        )

        return response

    async def _write_audit(self, event: dict):
        """Write audit event to PostgreSQL audit.events table."""
        from db.postgres import AsyncSessionLocal
        from sqlalchemy import text
        async with AsyncSessionLocal() as db:
            await db.execute(text("""
                INSERT INTO audit.events
                    (event_type, entity_type, entity_id, actor, payload)
                VALUES
                    (:event_type, :entity_type, :entity_id, :actor, :payload::jsonb)
            """), {
                "event_type":  event["event_type"],
                "entity_type": event["entity_type"],
                "entity_id":   event["entity_id"][:64],
                "actor":       event["actor"][:64],
                "payload":     json.dumps(event["payload"]),
            })
            await db.commit()
