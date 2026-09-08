"""
"Make the first one smaller" only works honestly if the agent actually
observes the step's real current size before proposing a new one — not a
hardcoded response. get_task_breakdown (read) + update_task_step (write_low,
no confirmation needed — low-stakes and reversible) close that loop.
"""

from backend.database import SessionLocal
from backend.models import adhd_models
from backend.services import agent_service
from backend.services.agent_tools import ToolContext, _create_task_breakdown, _get_task_breakdown, _update_task_step, ToolError
from backend.tests.conftest import FakeFunctionCall, FakePart, FakeResponse
import pytest


def test_get_task_breakdown_returns_real_per_step_detail_not_just_a_count(user_a):
    db = SessionLocal()
    try:
        ctx = ToolContext(db=db, user=user_a)
        _create_task_breakdown({"task": "Finish literature review"}, ctx)
        result = _get_task_breakdown({}, ctx)
    finally:
        db.close()

    assert result["original_task"] == "Finish literature review"
    assert len(result["steps"]) >= 1
    assert "estimated_minutes" in result["steps"][0]
    assert "description" in result["steps"][0]


def test_get_task_breakdown_raises_a_user_facing_error_when_none_exists(user_a):
    db = SessionLocal()
    try:
        ctx = ToolContext(db=db, user=user_a)
        with pytest.raises(ToolError):
            _get_task_breakdown({}, ctx)
    finally:
        db.close()


def test_update_task_step_changes_the_real_db_row_and_needs_no_confirmation(user_a, install_fake_gemini):
    db = SessionLocal()
    try:
        ctx = ToolContext(db=db, user=user_a)
        created = _create_task_breakdown({"task": "Finish literature review"}, ctx)
        first_step_id = created["steps"][0]["id"]
    finally:
        db.close()

    tool_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall(
        "update_task_step", {"step_index": 0, "new_estimated_minutes": 5}
    ))])
    install_fake_gemini([tool_call])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("make the first step smaller")
        step = db.query(adhd_models.TaskStep).filter_by(id=first_step_id).one()
    finally:
        db.close()

    # write_low: executes immediately, never stops for confirmation.
    assert result["state"] != "CONFIRMATION_REQUIRED"
    assert step.estimated_minutes == 5


def test_update_task_step_rejects_an_out_of_range_index(user_a):
    db = SessionLocal()
    try:
        ctx = ToolContext(db=db, user=user_a)
        _create_task_breakdown({"task": "Finish literature review"}, ctx)
        with pytest.raises(ToolError):
            _update_task_step({"step_index": 99, "new_estimated_minutes": 5}, ctx)
    finally:
        db.close()


def test_making_a_step_smaller_is_genuinely_driven_by_the_real_observed_size_not_a_hardcoded_value(
    user_a, install_fake_gemini_reactive
):
    """The reactive fake only knows what "smaller" means because it reads the
    REAL get_task_breakdown result and computes half of the REAL current
    value — proving the agent's second call depends on actually observed
    data, exactly like the existing OCD/ADHD dynamic-replanning proofs."""
    db = SessionLocal()
    try:
        ctx = ToolContext(db=db, user=user_a)
        _create_task_breakdown({"task": "Finish literature review"}, ctx)
        # Deliberately set a distinctive, known starting size so the test can
        # verify the *computed* result, not just that "some number" changed.
        breakdown = db.query(adhd_models.TaskBreakdown).filter_by(user_id=user_a.id).first()
        first_step = sorted(breakdown.steps, key=lambda s: s.id)[0]
        first_step.estimated_minutes = 40
        db.commit()
    finally:
        db.close()

    def responder(call_index, payload):
        if call_index == 0:
            return FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("get_task_breakdown", {}))])
        if call_index == 1:
            fr = payload.parts[0].function_response
            result = dict(fr.response.get("result"))
            observed_minutes = result["steps"][0]["estimated_minutes"]
            assert observed_minutes == 40  # the real, just-observed value
            smaller = observed_minutes // 2
            return FakeResponse(parts=[FakePart(function_call=FakeFunctionCall(
                "update_task_step", {"step_index": 0, "new_estimated_minutes": smaller}
            ))])
        raise AssertionError("unexpected extra LLM round trip")

    install_fake_gemini_reactive(responder)

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        orchestrator.process_message("make the first step of my task breakdown smaller")
        breakdown = db.query(adhd_models.TaskBreakdown).filter_by(user_id=user_a.id).first()
        first_step = sorted(breakdown.steps, key=lambda s: s.id)[0]
    finally:
        db.close()

    assert first_step.estimated_minutes == 20  # 40 // 2 — computed from the real observed value
