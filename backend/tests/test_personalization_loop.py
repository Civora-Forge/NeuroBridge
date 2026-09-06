"""
P2 — closes the personalization loop: InterventionOutcome was written on every
successful write but never read back. It's read back now, compactly (not raw
history), and only for the module actually relevant to the current request.
"""

from backend.database import SessionLocal
from backend.services.agent_service import AgentOrchestrator
from backend.services.agent_tools import ToolContext, TOOL_REGISTRY, get_personalization_summary, _start_focus_session


def test_no_history_returns_none(user_a):
    db = SessionLocal()
    try:
        assert get_personalization_summary("adhd", user_a.id, db) is None
    finally:
        db.close()


def test_outcome_history_is_summarized_compactly_not_raw(user_a):
    # InterventionOutcome rows are written by the orchestrator's dispatch (_execute_tool),
    # not by the raw tool handler — go through the real path so there's real history to read.
    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db, user_a)
        tool = TOOL_REGISTRY["start_focus_session"]
        orchestrator._execute_tool(tool, {"intent": "essay", "duration_minutes": 20})
        orchestrator._execute_tool(tool, {"intent": "reading", "duration_minutes": 20})
        orchestrator._execute_tool(tool, {"intent": "chores", "duration_minutes": 45})

        summary = get_personalization_summary("adhd", user_a.id, db)
    finally:
        db.close()

    assert summary is not None
    assert "adhd" in summary.lower()
    assert "20" in summary  # the more common duration should surface
    # Compact — a short sentence, not a dump of every session's full details.
    assert len(summary) < 300


def test_personalization_summary_is_used_in_context_when_module_relevant(user_a):
    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db, user_a)
        orchestrator._execute_tool(TOOL_REGISTRY["start_focus_session"], {"intent": "essay", "duration_minutes": 15})
        bundle = orchestrator._build_context_bundle(None, frozenset({"adhd"}))
    finally:
        db.close()

    assert "recent adhd activity" in bundle.lower()


def test_personalization_summary_never_leaks_across_users(user_a, user_b):
    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db, user_a)
        orchestrator._execute_tool(TOOL_REGISTRY["start_focus_session"], {"intent": "essay", "duration_minutes": 20})
        summary_a = get_personalization_summary("adhd", user_a.id, db)
        summary_b = get_personalization_summary("adhd", user_b.id, db)
    finally:
        db.close()

    assert summary_a is not None
    assert summary_b is None
