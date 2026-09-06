"""
P1.5 — deterministic fast-path reads: the real tool is still called (real data,
real DB), but the "which tool should I call" LLM round trip is skipped
entirely for a small, exact-match allowlist of unambiguous reads.
"""

from backend.database import SessionLocal
from backend.services import agent_service
from backend.services.agent_tools import ToolContext, _create_exposure
from backend.services.fast_path import match_fast_path_read


def test_fast_path_matches_only_exact_unambiguous_phrases():
    assert match_fast_path_read("Show my OCD progress") == "get_ocd_progress"
    assert match_fast_path_read("show me my erp progress.") == "get_ocd_progress"
    assert match_fast_path_read("show my recent tasks") == "get_recent_tasks"
    assert match_fast_path_read("show my anxiety history") == "get_anxiety_history"
    # Compound / non-exact requests must NOT match — they need the real agent loop.
    assert match_fast_path_read("show my OCD progress and start a new exposure") is None
    assert match_fast_path_read("I think my OCD progress is show-worthy") is None
    assert match_fast_path_read("") is None


def test_fast_path_read_never_calls_gemini(user_a, install_fake_gemini):
    """Even with a fake Gemini fully wired and ready to answer, a fast-path
    message must never reach it — proves the LLM round trip is genuinely
    skipped, not just fast."""
    call_log, construction_count = install_fake_gemini([])  # calling it at all would crash

    db = SessionLocal()
    try:
        _create_exposure({"description": "Touch a doorknob", "estimated_suds": 40}, ToolContext(db=db, user=user_a))
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("show my ocd progress")
    finally:
        db.close()

    assert construction_count["n"] == 0
    assert call_log == []
    assert result["state"] == "COMPLETED"
    assert "1 exposure" in result["response"] or "hierarchy" in result["response"].lower()


def test_fast_path_still_calls_the_real_tool_not_fabricated_data(user_a, install_fake_gemini):
    """The historical bug this fixes: an earlier deterministic shortcut skipped
    real data retrieval entirely for "show progress" phrasing. This must not
    regress — the number in the response must trace back to a real DB row."""
    install_fake_gemini([])

    db = SessionLocal()
    try:
        # Different categories -> two distinct hierarchies (same category would merge
        # into one, which is correct _create_exposure behavior, not what this test needs).
        _create_exposure({"description": "Exposure 1", "category": "contamination"}, ToolContext(db=db, user=user_a))
        _create_exposure({"description": "Exposure 2", "category": "symmetry"}, ToolContext(db=db, user=user_a))
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("show my ocd progress")
    finally:
        db.close()

    assert "2 exposure" in result["response"]


def test_fast_path_handles_empty_state_gracefully(user_a, install_fake_gemini):
    install_fake_gemini([])
    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("show my anxiety history")
    finally:
        db.close()
    assert result["state"] == "COMPLETED"
    assert "haven't logged" in result["response"].lower() or "start" in result["response"].lower()


def test_non_matching_message_falls_through_to_real_agent_loop(user_a, install_fake_gemini):
    """A message that ISN'T an exact fast-path phrase must still reach Gemini —
    the fast path must not become a router that silently swallows everything."""
    from backend.tests.conftest import FakeResponse, FakePart

    final = FakeResponse(parts=[FakePart()], text="Sure, tell me more.")
    call_log, construction_count = install_fake_gemini([final])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        orchestrator.process_message("I'm not sure what's going on with my OCD progress lately, can we talk about it?")
    finally:
        db.close()

    assert construction_count["n"] == 1
