"""
Backend authentication: validates the Supabase access token the frontend
attaches as `Authorization: Bearer <token>` on every request.

We don't hold a JWT signing secret locally, so verification is delegated to
Supabase itself (GET /auth/v1/user) using the project's anon key. This is a
network round trip per (uncached) request, so successful lookups are cached
briefly in-process to keep the agent responsive under repeated calls in one
session.
"""

import os
import time
from typing import Optional

import httpx
from fastapi import Header, HTTPException, status
from pydantic import BaseModel

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

_TOKEN_CACHE_TTL_SECONDS = 60
_token_cache: dict[str, tuple[float, "CurrentUser"]] = {}


class CurrentUser(BaseModel):
    id: str
    email: Optional[str] = None


def _validate_with_supabase(token: str) -> CurrentUser:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Backend auth is not configured (SUPABASE_URL/SUPABASE_ANON_KEY missing).",
        )

    try:
        response = httpx.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
            timeout=5.0,
        )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not reach the authentication service. Please try again.",
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired or is invalid. Please sign in again.",
        )

    data = response.json()
    user_id = data.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session.")

    return CurrentUser(id=str(user_id), email=data.get("email"))


def get_current_user(authorization: Optional[str] = Header(default=None)) -> CurrentUser:
    """FastAPI dependency: raises 401 unless a valid Supabase session token is present."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in with your NeuroBridge account to use this feature.",
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing session token.")

    now = time.monotonic()
    cached = _token_cache.get(token)
    if cached and cached[0] > now:
        return cached[1]

    user = _validate_with_supabase(token)
    _token_cache[token] = (now + _TOKEN_CACHE_TTL_SECONDS, user)
    return user
