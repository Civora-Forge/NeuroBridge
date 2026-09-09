"""
Latency optimization (Phase 4/5 of the "make agentic AI the best feature"
work): "pause"/"resume"/"stop" have no ambiguity to resolve once we know
whether there's a real active focus session, so they skip the LLM round
trip entirely — same proof pattern as test_fast_path.py, but for real
WRITE_LOW control actions instead of READ renders.
"""

from backend.database import SessionLocal
from backend.services import agent_service
from backend.services.agent_tools import ToolContext, TOOL_REGISTRY
from backend.services.contextual_commands import match_contextual_command


def test_matches_only_exact_short_commands():
    assert match_contextual_command("Pause.") == "pause"
    assert match_contextual_command("pause") == "pause"
    assert match_contextual_command("Resume") == "resume"
    assert match_contextual_command("continue") == "resume"
    assert match_contextual_command("Stop.") == "stop"
    assert match_contextual_command("end the session") == "stop"
    # Anything needing real interpretation must NOT match.
    assert match_contextual_command("should I pause?") is None
    assert match_contextual_command("pause and tell me why") is None
    assert match_contextual_command("what's next") is None
    assert match_contextual_command("") is None


def _start_session(db, user):
    TOOL_REGISTRY["start_focus_session"].handler({"duration_minutes": 25}, ToolContext(db=db, user=user))


def test_pause_with_an_active_session_never_calls_gemini(user_a, install_fake_gemini):
    call_log, construction_count = install_fake_gemini([])  # calling it at all would crash

    db = SessionLocal()
    try:
        _start_session(db, user_a)
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("Pause.")
    finally:
        db.close()

    assert construction_count["n"] == 0
    assert call_log == []
    assert result["state"] == "COMPLETED"
    assert result["action"]["type"] == "FOCUS_SESSION_CONTROL"
    assert result["action"]["command"] == "pause"
    assert "paused" in result["response"].lower()


def test_resume_after_pause_never_calls_gemini_either(user_a, install_fake_gemini):
    install_fake_gemini([])
    db = SessionLocal()
    try:
        _start_session(db, user_a)
        TOOL_REGISTRY["pause_focus_session"].handler({}, ToolContext(db=db, user=user_a))
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("continue")
    finally:
        db.close()

    assert result["state"] == "COMPLETED"
    assert result["action"]["command"] == "resume"
    assert "resumed" in result["response"].lower()


def test_stop_ends_the_real_session_with_zero_llm_calls(user_a, install_fake_gemini):
    install_fake_gemini([])
    db = SessionLocal()
    try:
        _start_session(db, user_a)
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("stop")
    finally:
        db.close()

    assert result["action"]["command"] == "stop"
    from backend.models import adhd_models
    db2 = SessionLocal()
    try:
        row = db2.query(adhd_models.FocusSession).filter_by(user_id=user_a.id).first()
        assert row.status == "STOPPED"
    finally:
        db2.close()


def test_pause_with_no_active_session_is_a_real_deterministic_error_not_a_crash(user_a, install_fake_gemini):
    """Still zero LLM calls — the "no active session" fact is itself
    deterministic, so there's nothing for Gemini to add."""
    call_log, construction_count = install_fake_gemini([])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("pause")
    finally:
        db.close()

    assert construction_count["n"] == 0
    assert result["state"] == "COMPLETED"
    assert "no active focus session" in result["response"].lower()


def test_non_exact_pause_phrasing_falls_through_to_the_real_agent_loop(user_a, install_fake_gemini):
    """"Can you pause my session for a sec?" needs real interpretation (it's
    not an exact match), so it must still reach Gemini — the shortcut must
    not become a silent router that swallows near-matches."""
    from backend.tests.conftest import FakeResponse, FakePart

    final = FakeResponse(parts=[FakePart()], text="Sure, pausing now.")
    call_log, construction_count = install_fake_gemini([final])

    db = SessionLocal()
    try:
        _start_session(db, user_a)
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        orchestrator.process_message("Can you pause my session for a sec?")
    finally:
        db.close()

    assert construction_count["n"] == 1
