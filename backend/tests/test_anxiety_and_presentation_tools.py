"""
Generalizing the agentic layer beyond the ADHD pilot, module by module —
starting with the two smallest genuine gaps found by audit:

1. Anxiety: start_grounding_activity existed but nothing ever recorded how
   the exercise went (post_anxiety was write-only in the model, unused
   everywhere). complete_grounding_activity closes that loop.

2. A cross-cutting presentation-preset tool ("make this simpler", "reduce
   the animations") — pure intent resolution, no DB write, since the
   preference is a per-device display choice, not user data.
"""

from backend.database import SessionLocal
from backend.models import anxiety_models
from backend.services import agent_service
from backend.services.agent_tools import (
    ToolContext, ToolError, TOOL_REGISTRY,
    _start_grounding_activity, _complete_grounding_activity, _set_presentation_preset,
)
from backend.tests.conftest import FakeFunctionCall, FakePart, FakeResponse
import pytest


def test_complete_grounding_activity_records_the_real_post_anxiety_value(user_a):
    db = SessionLocal()
    try:
        started = _start_grounding_activity({"anxiety_level": 8}, ToolContext(db=db, user=user_a))
        result = _complete_grounding_activity({"session_id": started["id"], "post_anxiety": 3}, ToolContext(db=db, user=user_a))
        session = db.query(anxiety_models.GroundingSession).filter_by(id=started["id"]).one()
    finally:
        db.close()

    assert result["post_anxiety"] == 3
    assert session.post_anxiety == 3
    assert session.pre_anxiety == 8  # untouched


def test_complete_grounding_activity_defaults_to_the_most_recent_session_when_no_id_given(user_a):
    db = SessionLocal()
    try:
        _start_grounding_activity({"anxiety_level": 5}, ToolContext(db=db, user=user_a))
        result = _complete_grounding_activity({"post_anxiety": 2}, ToolContext(db=db, user=user_a))
    finally:
        db.close()

    assert result["post_anxiety"] == 2


def test_complete_grounding_activity_raises_a_clear_error_with_nothing_to_complete(user_a):
    db = SessionLocal()
    try:
        with pytest.raises(ToolError):
            _complete_grounding_activity({"post_anxiety": 2}, ToolContext(db=db, user=user_a))
    finally:
        db.close()


def test_complete_grounding_activity_is_scoped_to_the_owning_user(user_a, user_b):
    db = SessionLocal()
    try:
        started = _start_grounding_activity({"anxiety_level": 6}, ToolContext(db=db, user=user_a))
        with pytest.raises(ToolError):
            _complete_grounding_activity({"session_id": started["id"], "post_anxiety": 1}, ToolContext(db=db, user=user_b))
        session = db.query(anxiety_models.GroundingSession).filter_by(id=started["id"]).one()
        assert session.post_anxiety is None  # user_b's attempt did not touch it
    finally:
        db.close()


def test_voice_shaped_anxiety_flow_start_then_complete_through_the_real_orchestrator(user_a, install_fake_gemini):
    tool_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("start_grounding_activity", {"anxiety_level": 8}))])
    install_fake_gemini([tool_call])
    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("I'm really anxious right now")
        session_id = result["action"]["data"]["id"]
    finally:
        db.close()

    complete_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("complete_grounding_activity", {"session_id": session_id, "post_anxiety": 3}))])
    install_fake_gemini([complete_call])
    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result2 = orchestrator.process_message("okay I feel better now, about a 3")
        session = db.query(anxiety_models.GroundingSession).filter_by(id=session_id).one()
    finally:
        db.close()

    assert result2["state"] != "CONFIRMATION_REQUIRED"  # write_low, no confirmation needed
    assert session.post_anxiety == 3


def test_set_presentation_preset_accepts_a_known_preset(user_a):
    result = _set_presentation_preset({"preset_id": "low_stimulation"}, ToolContext(db=None, user=user_a))
    assert result == {"preset_id": "low_stimulation"}


def test_set_presentation_preset_rejects_an_unknown_preset(user_a):
    with pytest.raises(ToolError):
        _set_presentation_preset({"preset_id": "extremely_busy"}, ToolContext(db=None, user=user_a))


def test_voice_request_to_make_things_simpler_resolves_to_the_real_preset_tool(user_a, install_fake_gemini):
    tool_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("set_presentation_preset", {"preset_id": "focus"}))])
    install_fake_gemini([tool_call])
    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("can you make this simpler, there's too much going on")
    finally:
        db.close()

    assert result["action"]["type"] == "PRESENTATION_PRESET"
    assert result["action"]["preset_id"] == "focus"
    assert result["state"] != "CONFIRMATION_REQUIRED"


def test_presentation_preset_tool_is_registered_as_write_low_not_confirm_gated(user_a):
    from backend.services.agent_tools import RiskLevel
    tool = TOOL_REGISTRY["set_presentation_preset"]
    assert tool.risk_level == RiskLevel.WRITE_LOW
