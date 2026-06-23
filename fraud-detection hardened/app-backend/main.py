from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import random
import os
import jwt
from jwt import PyJWTError

app = FastAPI(title="Decision Intelligence API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production-demo-only")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# Demo users (hardcoded for demo purposes - plain text for simplicity)
DEMO_USERS = {
    "admin": {"username": "admin", "password": "admin2024!", "role": "ADMIN", "id": "1"},
    "analyst1": {"username": "analyst1", "password": "analyst2024!", "role": "ANALYST", "id": "2"},
    "ops1": {"username": "ops1", "password": "ops2024!", "role": "OPS_MANAGER", "id": "3"},
    "partner1": {"username": "partner1", "password": "partner2024!", "role": "BANK_PARTNER", "id": "4"},
}

def verify_password(plain_password: str, stored_password: str) -> bool:
    # Plain text comparison for demo purposes
    return plain_password == stored_password

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except PyJWTError:
        raise credentials_exception
    
    user = DEMO_USERS.get(username)
    if user is None:
        raise credentials_exception
    return user

# Models
class LoginRequest(BaseModel):
    username: str
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    username: str

class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    org_id: Optional[str] = None

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

# Authentication endpoints
@app.post("/auth/login")
async def login(request: LoginRequest):
    user = DEMO_USERS.get(request.username)
    if not user or not verify_password(request.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    access_token = create_access_token(data={"sub": user["username"]})
    refresh_token = create_refresh_token(data={"sub": user["username"]})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=user["role"],
        username=user["username"]
    )

@app.post("/auth/refresh")
async def refresh(request: RefreshRequest):
    try:
        payload = jwt.decode(request.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        username = payload.get("sub")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        user = DEMO_USERS.get(username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        access_token = create_access_token(data={"sub": user["username"]})
        new_refresh_token = create_refresh_token(data={"sub": user["username"]})
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            role=user["role"],
            username=user["username"]
        )
    except PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

@app.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        role=current_user["role"],
        org_id=None
    )

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
