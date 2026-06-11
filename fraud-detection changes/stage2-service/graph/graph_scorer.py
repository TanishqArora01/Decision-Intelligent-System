"""
graph/graph_scorer.py
Runs Neo4j graph intelligence queries for a Stage 2 request.
"""
from __future__ import annotations

import logging

from graph.neo4j_client import Neo4jClient
from graph.queries import run_all_graph_queries
from schemas import GraphRiskResult, Stage2Request

logger = logging.getLogger(__name__)


class GraphScorer:
    def __init__(self, client: Neo4jClient):
        self.client = client

    def score(self, req: Stage2Request) -> GraphRiskResult:
        if self.client.available:
            try:
                self.client.upsert_transaction({
                    "txn_id": req.txn_id,
                    "customer_id": req.customer_id,
                    "device_id": req.device_id or "unknown",
                    "ip_address": req.ip_address or "0.0.0.0",
                    "merchant_id": req.merchant_id or "unknown",
                    "merchant_category": "general",
                    "amount": req.amount,
                    "channel": req.channel,
                    "country_code": req.country_code,
                    "segment": req.customer_segment,
                    "account_age_days": req.account_age_days,
                    "clv": req.clv,
                })
            except Exception as e:
                logger.debug("Graph upsert skipped: %s", e)

        data = run_all_graph_queries(
            self.client,
            req.customer_id,
            req.device_id,
            req.account_age_days,
        )
        return GraphRiskResult(**data)
