"""
Deterministic routing for short, mechanical session-control commands.

"Pause." / "Resume." / "Stop." have no ambiguity to resolve once the real
tool has told us whether there's an active focus session — that's a fact
lookup, not a reasoning task, so paying for a full Gemini round trip (and
its ~1-3s latency) to re-derive "the user wants pause_focus_session" is
pure waste. This mirrors fast_path.py's exact-phrase philosophy, but for
WRITE_LOW control actions instead of READ renders.

Deliberately NOT handled here (left to the real agent, since they need
actual reasoning): "what's next", "make this easier", "start it" (which
tool "it" refers to isn't mechanical), anything not an exact match below.
"""

from __future__ import annotations

_PAUSE_PHRASES = {"pause", "pause it", "pause that", "pause the session", "pause my session", "pause my focus session"}
_RESUME_PHRASES = {
    "resume", "continue", "unpause", "resume it", "continue it", "resume that",
    "keep going", "resume the session", "continue the session", "resume my session",
}
_STOP_PHRASES = {
    "stop", "end it", "end the session", "stop the session", "cancel the session",
    "end session", "stop my session", "i'm done", "im done", "finish the session",
}

_COMMAND_TO_TOOL = {
    "pause": "pause_focus_session",
    "resume": "resume_focus_session",
    "stop": "stop_focus_session",
}


def match_contextual_command(message: str) -> str | None:
    """Returns 'pause' | 'resume' | 'stop', or None if the message isn't an
    exact match for one of these short commands. Exact-match only (like
    fast_path) — "pause and tell me why" or "should I pause?" must NOT
    match, since those need real interpretation."""
    normalized = (message or "").strip().lower().rstrip(".!?").replace("'", "")
    if normalized in _PAUSE_PHRASES:
        return "pause"
    if normalized in _RESUME_PHRASES:
        return "resume"
    if normalized in _STOP_PHRASES:
        return "stop"
    return None


def tool_name_for(command: str) -> str:
    return _COMMAND_TO_TOOL[command]
