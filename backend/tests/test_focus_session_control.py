"""
The agent must be able to genuinely start/pause/resume/stop/retarget a focus
session — with the backend as the one authoritative record of intended
status (RUNNING/PAUSED/STOPPED), timestamp-derived remaining time (no stored
countdown to drift), and real transition validation (no PAUSED->PAUSED,
no resuming a STOPPED session, etc.)
"""

import time

from backend.database import SessionLocal
from backend.models import adhd_models
from backend.services import agent_service
from backend.services.agent_tools import (
    ToolContext, ToolError, TOOL_REGISTRY,
    _get_active_focus_session, _pause_focus_session, _resume_focus_session,
    _stop_focus_session, _update_focus_session,
)
from backend.tests.conftest import FakeFunctionCall, FakePart, FakeResponse
import pytest


def _start(db, user, **kwargs):
    return TOOL_REGISTRY["start_focus_session"].handler({"intent": "essay", "duration_minutes": 25, **kwargs}, ToolContext(db=db, user=user))


def test_start_creates_a_running_session_with_real_timestamps(user_a):
    db = SessionLocal()
    try:
        result = _start(db, user_a)
        session = db.query(adhd_models.FocusSession).filter_by(id=result["id"]).one()
    finally:
        db.close()

    assert result["status"] == "RUNNING"
    assert session.started_at is not None
    assert session.accumulated_seconds == 0


def test_get_active_focus_session_reports_real_remaining_time_derived_from_timestamps(user_a):
    db = SessionLocal()
    try:
        _start(db, user_a, duration_minutes=1)
        time.sleep(1.1)
        result = _get_active_focus_session({}, ToolContext(db=db, user=user_a))
    finally:
        db.close()

    # 1 minute duration, ~1.1s elapsed -> remaining should have ticked down, not be a static 60.
    assert 0 < result["remaining_seconds"] < 60


def test_get_active_focus_session_raises_when_nothing_is_active(user_a):
    db = SessionLocal()
    try:
        with pytest.raises(ToolError):
            _get_active_focus_session({}, ToolContext(db=db, user=user_a))
    finally:
        db.close()


def test_pause_banks_elapsed_time_and_transitions_to_paused(user_a):
    db = SessionLocal()
    try:
        _start(db, user_a)
        time.sleep(1.1)
        result = _pause_focus_session({}, ToolContext(db=db, user=user_a))
        session = db.query(adhd_models.FocusSession).filter_by(id=result["id"]).one()
    finally:
        db.close()

    assert result["status"] == "PAUSED"
    assert session.accumulated_seconds >= 1
    assert session.paused_at is not None


def test_pausing_an_already_paused_session_is_rejected_not_silently_accepted(user_a):
    db = SessionLocal()
    try:
        _start(db, user_a)
        _pause_focus_session({}, ToolContext(db=db, user=user_a))
        with pytest.raises(ToolError):
            _pause_focus_session({}, ToolContext(db=db, user=user_a))
    finally:
        db.close()


def test_resume_transitions_paused_back_to_running(user_a):
    db = SessionLocal()
    try:
        _start(db, user_a)
        _pause_focus_session({}, ToolContext(db=db, user=user_a))
        result = _resume_focus_session({}, ToolContext(db=db, user=user_a))
    finally:
        db.close()

    assert result["status"] == "RUNNING"


def test_resuming_a_session_that_is_not_paused_is_rejected(user_a):
    db = SessionLocal()
    try:
        _start(db, user_a)  # RUNNING, never paused
        with pytest.raises(ToolError):
            _resume_focus_session({}, ToolContext(db=db, user=user_a))
    finally:
        db.close()


def test_stop_works_from_running_and_from_paused(user_a):
    db = SessionLocal()
    try:
        r1 = _start(db, user_a)
        result = _stop_focus_session({}, ToolContext(db=db, user=user_a))
        session = db.query(adhd_models.FocusSession).filter_by(id=r1["id"]).one()
    finally:
        db.close()
    assert result["status"] == "STOPPED"
    assert session.ended_at is not None

    db = SessionLocal()
    try:
        _start(db, user_a)
        _pause_focus_session({}, ToolContext(db=db, user=user_a))
        result2 = _stop_focus_session({}, ToolContext(db=db, user=user_a))
    finally:
        db.close()
    assert result2["status"] == "STOPPED"


def test_stopping_with_nothing_active_is_a_clear_error_not_a_silent_noop(user_a):
    db = SessionLocal()
    try:
        with pytest.raises(ToolError):
            _stop_focus_session({}, ToolContext(db=db, user=user_a))
    finally:
        db.close()


def test_update_focus_session_changes_the_real_target_duration(user_a):
    db = SessionLocal()
    try:
        _start(db, user_a, duration_minutes=25)
        result = _update_focus_session({"duration_minutes": 15}, ToolContext(db=db, user=user_a))
    finally:
        db.close()

    assert result["duration_minutes"] == 15


def test_stopped_session_cannot_be_resumed_or_re_stopped(user_a):
    db = SessionLocal()
    try:
        _start(db, user_a)
        _stop_focus_session({}, ToolContext(db=db, user=user_a))
        with pytest.raises(ToolError):
            _resume_focus_session({}, ToolContext(db=db, user=user_a))
        with pytest.raises(ToolError):
            _stop_focus_session({}, ToolContext(db=db, user=user_a))
    finally:
        db.close()


def test_pause_resume_stop_are_scoped_to_the_owning_user_only(user_a, user_b):
    db = SessionLocal()
    try:
        _start(db, user_a)
        # user_b has no active session of their own -> every control action fails safely,
        # never silently operating on user_a's session.
        with pytest.raises(ToolError):
            _pause_focus_session({}, ToolContext(db=db, user=user_b))
        with pytest.raises(ToolError):
            _stop_focus_session({}, ToolContext(db=db, user=user_b))
        # user_a's session is untouched by user_b's failed attempts.
        session = db.query(adhd_models.FocusSession).filter_by(user_id=user_a.id).first()
        assert session.status == "RUNNING"
    finally:
        db.close()


def test_voice_shaped_pause_then_resume_then_stop_drives_real_state_transitions_via_the_orchestrator(
    user_a, install_fake_gemini
):
    """The literal hands-free sequence: start -> pause -> resume -> stop, each
    a separate real orchestrator turn (as separate voice utterances would
    be), each producing a real FOCUS_SESSION_CONTROL action and a real DB
    transition — not a chatbot card, not a fabricated status string."""
    db = SessionLocal()
    try:
        start_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("start_focus_session", {"duration_minutes": 25}))])
        # A single-item fake response list would make the fake keep returning
        # the SAME function-call response every round (found while debugging
        # this exact test) — the round loop would then re-execute
        # start_focus_session on every round until max-steps, silently
        # creating multiple duplicate sessions. A final text response lets
        # the turn actually complete after one real execution.
        final = FakeResponse(parts=[FakePart()], text="Started your focus session.")
        install_fake_gemini([start_call, final])
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        r1 = orchestrator.process_message("Start a focus session.")
        assert r1["state"] == "COMPLETED"
        assert r1["action"]["type"] == "FOCUS_SESSION_CONTROL"
        assert r1["action"]["command"] == "start"
    finally:
        db.close()

    db = SessionLocal()
    try:
        only_one_session = db.query(adhd_models.FocusSession).filter_by(user_id=user_a.id).count()
        assert only_one_session == 1  # not 4 duplicate rows from repeated max-round execution
    finally:
        db.close()

    db = SessionLocal()
    try:
        pause_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("pause_focus_session", {}))])
        install_fake_gemini([pause_call])
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        r2 = orchestrator.process_message("Pause.")
        assert r2["action"]["command"] == "pause"
        assert r2["action"]["session"]["status"] == "PAUSED"
    finally:
        db.close()

    db = SessionLocal()
    try:
        resume_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("resume_focus_session", {}))])
        install_fake_gemini([resume_call])
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        r3 = orchestrator.process_message("Continue.")
        assert r3["action"]["command"] == "resume"
        assert r3["action"]["session"]["status"] == "RUNNING"
    finally:
        db.close()

    db = SessionLocal()
    try:
        stop_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("stop_focus_session", {}))])
        install_fake_gemini([stop_call])
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        r4 = orchestrator.process_message("Stop.")
        assert r4["action"]["command"] == "stop"
        assert r4["action"]["session"]["status"] == "STOPPED"
        # order_by, not .first() on an unordered query: this test only intends to
        # check the ONE session it created and drove through this whole sequence.
        session = (
            db.query(adhd_models.FocusSession)
            .filter_by(user_id=user_a.id)
            .order_by(adhd_models.FocusSession.id.desc())
            .first()
        )
        assert session.status == "STOPPED"
    finally:
        db.close()
