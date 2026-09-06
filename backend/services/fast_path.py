"""
Deterministic fast-path for genuinely unambiguous, read-only requests.

This is deliberately NOT an intent router for the whole agent — it's a tiny,
explicit allowlist of exact phrasings that map to exactly one real read tool.
Anything not an exact match here falls through to the real agent engine
(Gemini decides, possibly multi-step). The tool is always actually called —
this only skips the redundant "which tool should I call" LLM round trip, and
optionally the "how should I phrase this" one too, by rendering the real
result with a deterministic template instead of an LLM call.

Matching is exact-string (after normalization), not substring-contains: a
compound request like "show my OCD progress and start a new exposure" must
NOT match, because it isn't actually a single unambiguous read.
"""

from __future__ import annotations

FAST_PATH_PHRASES: dict[str, str] = {
    "show my ocd progress": "get_ocd_progress",
    "show me my ocd progress": "get_ocd_progress",
    "show my erp progress": "get_ocd_progress",
    "show me my erp progress": "get_ocd_progress",
    "how is my ocd progress": "get_ocd_progress",
    "how's my ocd progress": "get_ocd_progress",
    "check my ocd progress": "get_ocd_progress",
    "what's my ocd progress": "get_ocd_progress",
    "show my recent tasks": "get_recent_tasks",
    "show me my recent tasks": "get_recent_tasks",
    "what are my recent tasks": "get_recent_tasks",
    "show my task history": "get_recent_tasks",
    "show my adhd progress": "get_recent_tasks",
    "show my anxiety history": "get_anxiety_history",
    "show me my anxiety history": "get_anxiety_history",
    "show my grounding history": "get_anxiety_history",
    "what's my anxiety history": "get_anxiety_history",
}


def match_fast_path_read(message: str) -> str | None:
    normalized = (message or "").strip().lower().rstrip(".!?")
    return FAST_PATH_PHRASES.get(normalized)


def _plural(n: int, singular: str, plural: str | None = None) -> str:
    return singular if n == 1 else (plural or f"{singular}s")


def render_ocd_progress(result: dict) -> str:
    count = result.get("hierarchy_count", 0)
    sessions = result.get("completed_erp_sessions", 0)
    if count == 0:
        return "You haven't started an exposure hierarchy yet. Want to create your first exposure?"
    parts = [f"You have {count} exposure {_plural(count, 'hierarchy', 'hierarchies')}"]
    if sessions:
        parts.append(f"and completed {sessions} ERP {_plural(sessions, 'session')}")
        drop = result.get("average_suds_reduction")
        if drop is not None:
            parts.append(f"with an average SUDS drop of {drop} points")
        resisted = result.get("sessions_with_resisted_compulsion", 0)
        if resisted:
            parts.append(f"resisting the compulsion in {resisted} of them")
    else:
        parts.append("with no completed ERP sessions yet")
    return " ".join(parts) + "."


def render_recent_tasks(result: dict) -> str:
    breakdowns = result.get("recent_task_breakdowns", [])
    sessions = result.get("recent_focus_sessions", [])
    if not breakdowns and not sessions:
        return "You don't have any recent task breakdowns or focus sessions yet. Want to start one?"
    parts = []
    if breakdowns:
        latest = breakdowns[0]
        parts.append(
            f"Your most recent task breakdown was \"{latest['original_task']}\" ({latest['step_count']} steps), "
            f"with {len(breakdowns)} in total recently"
        )
    if sessions:
        latest = sessions[0]
        parts.append(
            f"your last focus session was {latest['duration_minutes']} minutes ({latest['status']}), "
            f"{len(sessions)} recently"
        )
    return "; ".join(parts).capitalize() + "."


def render_anxiety_history(result: dict) -> str:
    sessions = result.get("recent_grounding_sessions", [])
    if not sessions:
        return "You haven't logged a grounding session yet. Want to start one now?"
    latest = sessions[0]
    return (
        f"You've done {len(sessions)} grounding session{'s' if len(sessions) != 1 else ''} recently — "
        f"most recently \"{latest['exercise_type']}\" (starting anxiety {latest.get('pre_anxiety', '—')})."
    )


FAST_PATH_TEMPLATES = {
    "get_ocd_progress": render_ocd_progress,
    "get_recent_tasks": render_recent_tasks,
    "get_anxiety_history": render_anxiety_history,
}
