from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import random

app = FastAPI(title="Decision Intelligence API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class Transaction(BaseModel):
    id: str
    amount: float
    merchant: str
    timestamp: str
    status: str
    riskScore: float
    category: str

class AnalyticsOverview(BaseModel):
    total_decisions: int
    block_rate_pct: float
    avg_p_fraud: float
    p95_latency_ms: float
    approved: int
    blocked: int
    step_up: int
    manual_review: int

class FraudRateData(BaseModel):
    bucket: str
    block_rate_pct: float

class ActionData(BaseModel):
    action: str
    count: int

class TopRiskData(BaseModel):
    txn_id: str
    customer_id: str
    amount: float
    action: str
    p_fraud: float
    latency_ms: float

# Mock data generators
def generate_transactions(count: int = 5) -> List[Transaction]:
    merchants = ["Amazon", "Apple Store", "Netflix", "Uber", "Walmart", "Target", "Best Buy"]
    categories = ["retail", "electronics", "subscription", "transportation", "other"]
    statuses = ["approved", "flagged", "blocked"]
    
    return [
        Transaction(
            id=f"TXN{i:04d}",
            amount=round(random.uniform(10, 5000), 2),
            merchant=random.choice(merchants),
            timestamp=(datetime.now() - timedelta(hours=random.randint(0, 24))).isoformat(),
            status=random.choice(statuses),
            riskScore=round(random.uniform(0, 1), 2),
            category=random.choice(categories)
        )
        for i in range(count)
    ]

def generate_analytics_overview() -> AnalyticsOverview:
    return AnalyticsOverview(
        total_decisions=15420,
        block_rate_pct=2.3,
        avg_p_fraud=0.127,
        p95_latency_ms=145,
        approved=14989,
        blocked=342,
        step_up=89,
        manual_review=0
    )

def generate_fraud_rate(hours: int = 24) -> List[FraudRateData]:
    return [
        FraudRateData(
            bucket=(datetime.now() - timedelta(hours=hours-i)).isoformat(),
            block_rate_pct=round(random.uniform(1, 4), 2)
        )
        for i in range(hours)
    ]

def generate_actions() -> List[ActionData]:
    return [
        ActionData(action="APPROVE", count=14989),
        ActionData(action="BLOCK", count=342),
        ActionData(action="STEP_UP_AUTH", count=89),
        ActionData(action="MANUAL_REVIEW", count=0)
    ]

def generate_top_risk() -> List[TopRiskData]:
    actions = ["BLOCK", "BLOCK", "STEP_UP_AUTH", "APPROVE", "APPROVE"]
    return [
        TopRiskData(
            txn_id=f"TXN{i:04d}",
            customer_id=f"CUST{i:04d}",
            amount=round(random.uniform(500, 5000), 2),
            action=actions[i],
            p_fraud=round(random.uniform(0.1, 0.95), 2),
            latency_ms=random.randint(80, 200)
        )
        for i in range(5)
    ]

# Endpoints
@app.get("/")
async def root():
    return {
        "message": "Decision Intelligence API",
        "version": "1.0.0",
        "status": "operational"
    }

@app.get("/health")
async def health():
    return {
        "success": True,
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "api": "operational",
            "database": "operational"
        }
    }

@app.get("/api/transactions")
async def get_transactions():
    return {
        "success": True,
        "data": generate_transactions(10),
        "total": 10
    }

@app.get("/api/analytics/overview")
async def get_analytics_overview():
    return {
        "success": True,
        "data": generate_analytics_overview()
    }

@app.get("/api/analytics/fraud-rate")
async def get_fraud_rate(hours: int = 24):
    return {
        "success": True,
        "data": generate_fraud_rate(hours)
    }

@app.get("/api/analytics/actions")
async def get_actions(hours: int = 24):
    return {
        "success": True,
        "data": generate_actions()
    }

@app.get("/api/analytics/top-risk")
async def get_top_risk(hours: int = 1):
    return {
        "success": True,
        "data": generate_top_risk()
    }

@app.get("/api/analytics/latency")
async def get_latency(hours: int = 1):
    data = [
        {
            "bucket": (datetime.now() - timedelta(minutes=i)).isoformat(),
            "p50_latency_ms": round(85 + random.random() * 20, 2),
            "p95_latency_ms": round(120 + random.random() * 40, 2),
            "p99_latency_ms": round(180 + random.random() * 60, 2)
        }
        for i in range(60)
    ]
    return {
        "success": True,
        "data": data
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
