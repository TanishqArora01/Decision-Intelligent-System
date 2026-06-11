"""auth/jwt_handler.py — JWT token lifecycle."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
import bcrypt

from config import config


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _create_token(data: dict, expires_delta: timedelta) -> str:
    payload = {**data, "exp": datetime.now(timezone.utc) + expires_delta}
    return jwt.encode(payload, config.jwt_secret, algorithm=config.jwt_algorithm)


def create_access_token(user_id: str, username: str, role: str) -> str:
    return _create_token(
        {"sub": user_id, "username": username, "role": role, "type": "access"},
        timedelta(minutes=config.jwt_expire_minutes),
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        {"sub": user_id, "type": "refresh"},
        timedelta(minutes=config.jwt_refresh_expire_minutes),
    )


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, config.jwt_secret, algorithms=[config.jwt_algorithm])
    except JWTError:
        return None
