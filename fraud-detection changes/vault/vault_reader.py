"""
vault/vault_reader.py
Vault Secret Reader

Provides a simple interface for application services to fetch secrets
from HashiCorp Vault using AppRole authentication.

Falls back to environment variables if Vault is unavailable —
this ensures services work in dev without Vault running.

Usage:
    from vault.vault_reader import VaultReader, get_secret

    # Get a single secret value
    pg_password = get_secret("fraud/postgres", "password", fallback="dev_password")

    # Get all secrets for a path
    pg_secrets = VaultReader().get_all("fraud/postgres")
    # → {"password": "...", "user": "fraud_admin", "host": "postgres", ...}
"""
from __future__ import annotations

import logging
import os
from typing import Dict, Optional

logger = logging.getLogger("vault")

VAULT_ADDR       = os.getenv("VAULT_ADDR",       "http://vault:8201")
VAULT_TOKEN      = os.getenv("VAULT_TOKEN",       "")    # direct token (dev only)
VAULT_ROLE_ID    = os.getenv("VAULT_ROLE_ID",     "")    # AppRole auth
VAULT_SECRET_ID  = os.getenv("VAULT_SECRET_ID",   "")    # AppRole auth
VAULT_NAMESPACE  = os.getenv("VAULT_NAMESPACE",   "")    # Enterprise namespaces
VAULT_SECRET_PATH= os.getenv("VAULT_SECRET_PATH", "secret")


class VaultReader:
    def __init__(self):
        self._client  = None
        self._token   = VAULT_TOKEN
        self._available = None   # None = not yet tested

    def _get_client(self):
        if self._client is not None:
            return self._client
        try:
            import hvac
            client = hvac.Client(url=VAULT_ADDR, namespace=VAULT_NAMESPACE or None)

            # Auth: token > AppRole
            if self._token:
                client.token = self._token
            elif VAULT_ROLE_ID and VAULT_SECRET_ID:
                resp = client.auth.approle.login(
                    role_id   = VAULT_ROLE_ID,
                    secret_id = VAULT_SECRET_ID,
                )
                client.token = resp["auth"]["client_token"]
            else:
                logger.debug("No Vault credentials — will use env var fallbacks")
                self._available = False
                return None

            if client.is_authenticated():
                self._client    = client
                self._available = True
                logger.info("Connected to Vault at %s", VAULT_ADDR)
            else:
                self._available = False

        except ImportError:
            logger.debug("hvac not installed — using env var fallbacks")
            self._available = False
        except Exception as e:
            logger.debug("Vault unavailable (%s) — using env var fallbacks", e)
            self._available = False

        return self._client

    def get_all(self, path: str) -> Dict[str, str]:
        """Fetch all secrets at a KV-v2 path. Returns {} if unavailable."""
        client = self._get_client()
        if not client:
            return {}
        try:
            resp = client.secrets.kv.v2.read_secret_version(
                path=path, mount_point=VAULT_SECRET_PATH
            )
            return resp["data"]["data"] or {}
        except Exception as e:
            logger.debug("Vault read failed for %s: %s", path, e)
            return {}

    def get(self, path: str, key: str, fallback: str = "") -> str:
        """Fetch a single secret value, with env var fallback."""
        secrets = self.get_all(path)
        if key in secrets:
            return str(secrets[key])
        return fallback


# Module-level singleton
_reader: Optional[VaultReader] = None


def _get_reader() -> VaultReader:
    global _reader
    if _reader is None:
        _reader = VaultReader()
    return _reader


def get_secret(path: str, key: str, fallback: str = "", env_var: str = "") -> str:
    """
    Get a secret from Vault with env var fallback.

    Priority:
      1. Vault (if available and authenticated)
      2. Environment variable `env_var` (if provided)
      3. `fallback` value

    Examples:
        pg_pw = get_secret("fraud/postgres", "password",
                           env_var="POSTGRES_PASSWORD",
                           fallback="dev_password")
    """
    # Try Vault
    value = _get_reader().get(path, key)
    if value:
        return value

    # Try env var
    if env_var:
        env_value = os.getenv(env_var, "")
        if env_value:
            return env_value

    return fallback


def get_postgres_dsn(async_driver: bool = True) -> str:
    """Build PostgreSQL DSN from Vault secrets."""
    driver   = "postgresql+asyncpg" if async_driver else "postgresql"
    password = get_secret("fraud/postgres", "password", env_var="POSTGRES_PASSWORD", fallback="fraud_secret_2024")
    user     = get_secret("fraud/postgres", "user",     env_var="POSTGRES_USER",     fallback="fraud_admin")
    host     = get_secret("fraud/postgres", "host",     env_var="POSTGRES_HOST",     fallback="postgres")
    db       = get_secret("fraud/postgres", "database", env_var="POSTGRES_DB",       fallback="fraud_db")
    return f"{driver}://{user}:{password}@{host}:5432/{db}"


def get_jwt_secret() -> str:
    return get_secret("fraud/app", "jwt_secret",
                      env_var="JWT_SECRET",
                      fallback="change-me-in-production-fraud2024!")


def get_anon_salt() -> str:
    return get_secret("fraud/app", "anon_salt",
                      env_var="ANON_SALT",
                      fallback="fraud-anon-salt-2024")
