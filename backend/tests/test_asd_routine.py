"""
ASD had zero real backend state before this — the audit confirmed
asd_models.SocialScenario had no writers anywhere. This is genuinely new
capability (not just a wiring gap): a real, backend-persisted daily
routine/visual schedule, the actual research-grounded ASD need
(predictability, step-by-step structure — NICE CG142/CG170), not a
stereotype.

Also proves the "agent knows current state -> fast deterministic
resolution" principle from the redesign: "next"/"repeat"/"go back" skip
Gemini entirely, but ONLY once a real active routine confirms they're
unambiguous — unlike pause/resume/stop, these words alone need that check.
"""

from backend.database import SessionLocal
from backend.models import asd_models
from backend.services import agent_service
from backend.services.agent_tools import (
    ToolContext, ToolError, TOOL_REGISTRY,
    _create_daily_routine, _get_current_routine_step, _advance_routine_step, _go_back_routine_step,
)
from backend.services.contextual_commands import match_routine_command
from backend.tests.conftest import FakeFunctionCall, FakePart, FakeResponse
import pytest


def _seed_routine(db, user, titles=("Brush teeth", "Get dressed", "Eat breakfast")):
    return _create_daily_routine({"steps": list(titles)}, ToolContext(db=db, user=user))


def test_create_daily_routine_persists_real_ordered_steps(user_a):
    db = SessionLocal()
    try:
        result = _seed_routine(db, user_a)
        rows = db.query(asd_models.RoutineStep).filter_by(user_id=user_a.id).order_by(asd_models.RoutineStep.order_index).all()
    finally:
        db.close()

    assert result["total_steps"] == 3
    assert [r.title for r in rows] == ["Brush teeth", "Get dressed", "Eat breakfast"]
    assert rows[0].is_current is True
    assert rows[1].is_current is False


def test_creating_a_new_routine_replaces_the_unfinished_one(user_a):
    db = SessionLocal()
    try:
        _seed_routine(db, user_a, titles=("Old step 1", "Old step 2"))
        _seed_routine(db, user_a, titles=("New step 1",))
        rows = db.query(asd_models.RoutineStep).filter_by(user_id=user_a.id).all()
    finally:
        db.close()

    assert len(rows) == 1
    assert rows[0].title == "New step 1"


def test_get_current_routine_step_reports_real_position(user_a):
    db = SessionLocal()
    try:
        _seed_routine(db, user_a)
        result = _get_current_routine_step({}, ToolContext(db=db, user=user_a))
    finally:
        db.close()

    assert result["title"] == "Brush teeth"
    assert result["position"] == 1
    assert result["total_steps"] == 3


def test_get_current_routine_step_raises_when_no_active_routine(user_a):
    db = SessionLocal()
    try:
        with pytest.raises(ToolError):
            _get_current_routine_step({}, ToolContext(db=db, user=user_a))
    finally:
        db.close()


def test_advance_routine_step_moves_to_the_real_next_step(user_a):
    db = SessionLocal()
    try:
        _seed_routine(db, user_a)
        result = _advance_routine_step({}, ToolContext(db=db, user=user_a))
        rows = db.query(asd_models.RoutineStep).filter_by(user_id=user_a.id).order_by(asd_models.RoutineStep.order_index).all()
    finally:
        db.close()

    assert result["finished"] is False
    assert result["title"] == "Get dressed"
    assert result["position"] == 2
    assert rows[0].is_completed is True
    assert rows[0].is_current is False
    assert rows[1].is_current is True


def test_advancing_past_the_last_step_reports_the_routine_is_finished(user_a):
    db = SessionLocal()
    try:
        _seed_routine(db, user_a, titles=("Only step",))
        result = _advance_routine_step({}, ToolContext(db=db, user=user_a))
    finally:
        db.close()

    assert result["finished"] is True


def test_go_back_routine_step_returns_to_the_real_previous_step(user_a):
    db = SessionLocal()
    try:
        _seed_routine(db, user_a)
        _advance_routine_step({}, ToolContext(db=db, user=user_a))  # now on "Get dressed"
        result = _go_back_routine_step({}, ToolContext(db=db, user=user_a))
    finally:
        db.close()

    assert result["title"] == "Brush teeth"
    assert result["position"] == 1


def test_go_back_from_the_first_step_is_a_real_error(user_a):
    db = SessionLocal()
    try:
        _seed_routine(db, user_a)
        with pytest.raises(ToolError):
            _go_back_routine_step({}, ToolContext(db=db, user=user_a))
    finally:
        db.close()


def test_routine_steps_are_scoped_to_the_owning_user(user_a, user_b):
    db = SessionLocal()
    try:
        _seed_routine(db, user_a)
        with pytest.raises(ToolError):
            _get_current_routine_step({}, ToolContext(db=db, user=user_b))
        with pytest.raises(ToolError):
            _advance_routine_step({}, ToolContext(db=db, user=user_b))
    finally:
        db.close()


# --- Contextual command routing ---------------------------------------------

def test_routine_phrase_matching():
    assert match_routine_command("What's next?") == "peek"
    assert match_routine_command("next") == "advance"
    assert match_routine_command("Repeat that.") == "repeat"
    assert match_routine_command("Go back.") == "back"
    assert match_routine_command("what should I have for lunch") is None


def test_next_with_an_active_routine_never_calls_gemini(user_a, install_fake_gemini):
    call_log, construction_count = install_fake_gemini([])  # calling it at all would crash

    db = SessionLocal()
    try:
        _seed_routine(db, user_a)
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("next")
    finally:
        db.close()

    assert construction_count["n"] == 0
    assert call_log == []
    assert result["state"] == "COMPLETED"
    assert "Get dressed" in result["response"]


def test_whats_next_with_an_active_routine_is_read_only_and_deterministic(user_a, install_fake_gemini):
    install_fake_gemini([])
    db = SessionLocal()
    try:
        _seed_routine(db, user_a)
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("What's next?")
        current = db.query(asd_models.RoutineStep).filter_by(user_id=user_a.id, is_current=True).first()
    finally:
        db.close()

    assert "Brush teeth" in result["response"]
    assert current.title == "Brush teeth"  # peeking did not advance anything


def test_next_with_no_active_routine_falls_through_to_the_real_agent_loop(user_a, install_fake_gemini):
    """"next" alone is genuinely ambiguous without routine context — must
    reach Gemini rather than silently erroring or guessing."""
    final = FakeResponse(parts=[FakePart()], text="Next for what, exactly?")
    call_log, construction_count = install_fake_gemini([final])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        orchestrator.process_message("next")
    finally:
        db.close()

    assert construction_count["n"] == 1


def test_go_back_at_the_first_step_via_the_orchestrator_gives_a_real_honest_message(user_a, install_fake_gemini):
    install_fake_gemini([])
    db = SessionLocal()
    try:
        _seed_routine(db, user_a)
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("go back")
    finally:
        db.close()

    assert "first step" in result["response"].lower()


def test_voice_shaped_full_routine_walkthrough_through_the_real_orchestrator(user_a, install_fake_gemini):
    """The literal hands-free sequence a child would use: create -> what's
    next -> next -> next -> finished, each a separate real orchestrator
    turn, each producing real DB state changes."""
    tool_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall(
        "create_daily_routine", {"steps": ["Brush teeth", "Get dressed"]}
    ))])
    final = FakeResponse(parts=[FakePart()], text="Set up your morning routine.")
    install_fake_gemini([tool_call, final])
    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        r1 = orchestrator.process_message("set up my morning routine: brush teeth, then get dressed")
        assert r1["state"] == "COMPLETED"
    finally:
        db.close()

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        r2 = orchestrator.process_message("What's next?")
        assert "Brush teeth" in r2["response"]
    finally:
        db.close()

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        r3 = orchestrator.process_message("next")
        assert "Get dressed" in r3["response"]
    finally:
        db.close()

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        r4 = orchestrator.process_message("next")
        assert "complete" in r4["response"].lower()
        remaining = db.query(asd_models.RoutineStep).filter_by(user_id=user_a.id, is_completed=False).count()
        assert remaining == 0
    finally:
        db.close()


def test_create_daily_routine_tool_is_registered_write_low_not_confirm_gated():
    from backend.services.agent_tools import RiskLevel
    assert TOOL_REGISTRY["create_daily_routine"].risk_level == RiskLevel.WRITE_LOW
