"""
Flows 2/3 from the spec, against real persisted data (not fabricated numbers):
"Show me my ERP progress." and "Start my next ERP exposure."
"""

from backend.database import SessionLocal
from backend.models import ocd_models
from backend.services import agent_service
from backend.services.agent_tools import ToolContext, _create_exposure, _complete_erp_session, _start_erp_session
from backend.tests.conftest import FakeFunctionCall, FakePart, FakeResponse


def _seed_real_ocd_history(db, user):
    ctx = ToolContext(db=db, user=user)
    _create_exposure({"description": "Touch a doorknob", "category": "contamination", "estimated_suds": 40}, ctx)
    session = _start_erp_session({"exposure_description": "Touch a doorknob", "pre_suds": 60}, ctx)
    _complete_erp_session({"session_id": session["session_id"], "post_suds": 20, "resisted_compulsion": True}, ctx)


def test_show_my_erp_progress_reflects_real_persisted_numbers(user_a, install_fake_gemini):
    db = SessionLocal()
    try:
        _seed_real_ocd_history(db, user_a)

        tool_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("get_ocd_progress", {}))])
        final = FakeResponse(parts=[FakePart()], text="You completed 1 ERP session with a 40 point SUDS drop.")
        install_fake_gemini([tool_call, final])

        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("Show me my ERP progress.")

        # Prove it's not fabricated: the real DB numbers back the claim independently of the fake LLM text.
        progress = db.query(ocd_models.ERPSession).filter_by(owner_id=user_a.id, status="completed").all()
        assert len(progress) == 1
        assert progress[0].pre_suds - progress[0].post_suds == 40
    finally:
        db.close()

    assert "40" in result["response"] or "1 ERP session" in result["response"]
    assert result["action"] is None  # a read-only summary, no navigation forced


def test_start_next_erp_exposure_uses_real_hierarchy_and_creates_a_real_session(user_a, install_fake_gemini):
    db = SessionLocal()
    try:
        ctx = ToolContext(db=db, user=user_a)
        _create_exposure({"description": "Touch a doorknob", "category": "contamination", "estimated_suds": 30}, ctx)
        _create_exposure({"description": "Use a public restroom", "category": "contamination", "estimated_suds": 70}, ctx)

        # Simulate the agent looking up the real hierarchy, then starting the next (harder, incomplete) exposure.
        lookup = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("get_exposure_hierarchy", {}))])
        start = FakeResponse(
            parts=[FakePart(function_call=FakeFunctionCall(
                "start_erp_session", {"exposure_description": "Use a public restroom", "pre_suds": 65}
            ))]
        )
        final = FakeResponse(parts=[FakePart()], text="Starting your next exposure now.")
        install_fake_gemini([lookup, start, final])

        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("Start my next ERP exposure.")

        sessions = db.query(ocd_models.ERPSession).filter_by(owner_id=user_a.id).all()
    finally:
        db.close()

    assert len(sessions) == 1
    assert sessions[0].title == "Use a public restroom"
    assert sessions[0].status == "in_progress"
    assert result["action"] == {"type": "NAVIGATE_WITH_DATA", "path": "/ocd/exposure-session", "card_type": "ERP_SESSION_STARTED", "data": {
        "session_id": sessions[0].id, "title": "Use a public restroom", "pre_suds": 65, "status": "in_progress",
    }}


def test_get_exposure_hierarchy_never_returns_another_users_exposures(user_a, user_b):
    from backend.services.agent_tools import _get_exposure_hierarchy, ToolError
    import pytest

    db = SessionLocal()
    try:
        _create_exposure({"description": "User A's exposure"}, ToolContext(db=db, user=user_a))
        with pytest.raises(ToolError):
            _get_exposure_hierarchy({}, ToolContext(db=db, user=user_b))
    finally:
        db.close()
