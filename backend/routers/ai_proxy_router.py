"""
Server-side proxy for one-shot Gemini `generateContent` calls made from
frontend features that are NOT the main agent chat (dyslexia difficulty
analysis, ASD social-scenario/emotion-decoder generation, conversation
sentiment analysis, and Gemini Vision OCR for uploaded reading material).

Why this exists: these features used to call
`https://generativelanguage.googleapis.com/...?key=VITE_GEMINI_API_KEY`
directly from the browser. A `VITE_`-prefixed env var is compiled into the
public JS bundle, so that API key was extractable by anyone who opened
devtools — a real billing/abuse exposure, and it meant these calls had no
auth, no rate limiting, and no server-side visibility at all, unlike the main
agent chat (which already went through the backend). This endpoint closes
that gap: the frontend now sends the same `contents`/`generationConfig`
payload it always built, but to this authenticated, rate-limited backend
route, which attaches the real (server-only) GEMINI_API_KEY itself.

Deliberately thin: this does not interpret `contents` (it may contain plain
text or inline image data for OCR) — it is a pass-through, not a new place to
build prompts. It exists to keep the API key server-side and add the same
baseline auth/rate-limit/observability every other backend-mediated call
already gets, not to change what any of these features send to Gemini.
"""

import os
import threading
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Optional

from ..auth import CurrentUser, get_current_user

router = APIRouter()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
_ALLOWED_MODELS = {"gemini-1.5-flash", "gemini-2.5-flash", "gemini-3.5-flash", "gemini-3.6-flash"}
_DEFAULT_MODEL = "gemini-2.5-flash"

# Same shape of protection as agent_router.py's chat rate limiter: these calls
# cost real Gemini quota/money per request, so an unauthenticated flood (or a
# buggy retry loop) must not be able to run up an unbounded bill.
_RATE_LIMIT_MAX_REQUESTS = int(os.getenv("AI_PROXY_RATE_LIMIT_PER_HOUR", "120"))
_RATE_LIMIT_WINDOW_SECONDS = 3600
_request_timestamps: dict[str, list[float]] = {}
_rate_limit_lock = threading.Lock()


def _enforce_rate_limit(user: CurrentUser) -> None:
    now = time.time()
    with _rate_limit_lock:
        recent = [t for t in _request_timestamps.get(user.id, []) if now - t < _RATE_LIMIT_WINDOW_SECONDS]
        if len(recent) >= _RATE_LIMIT_MAX_REQUESTS:
            raise HTTPException(
                status_code=429,
                detail="You've made a lot of AI requests in a short time — please wait a bit before trying again.",
            )
        recent.append(now)
        _request_timestamps[user.id] = recent


class GenerateRequest(BaseModel):
    model: Optional[str] = None
    contents: list[dict[str, Any]] = Field(..., min_length=1)
    generation_config: Optional[dict[str, Any]] = None


@router.post("/generate")
def generate(request: GenerateRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="AI features aren't configured on the backend (missing GEMINI_API_KEY).")

    _enforce_rate_limit(user)

    model = request.model if request.model in _ALLOWED_MODELS else _DEFAULT_MODEL
    body: dict[str, Any] = {"contents": request.contents}
    if request.generation_config:
        body["generationConfig"] = request.generation_config

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    try:
        response = httpx.post(url, params={"key": GEMINI_API_KEY}, json=body, timeout=30.0)
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Couldn't reach the AI service. Please try again.")

    if response.status_code != 200:
        # Never forward Google's raw error body to the client — it can echo
        # back request details, and never forward the API key (it's only in
        # the outgoing request's query string, not in Google's response).
        raise HTTPException(status_code=502, detail="The AI service couldn't process that request.")

    return response.json()
