"""
write_confirm tools (e.g. create_exposure) must never execute just because the
LLM called them — only POST /api/agent/tool/execute, hit after explicit user
confirmation, may actually perform the write. This also re-validates
ownership itself rather than trusting the frontend.
"""

from backend.database import SessionLocal
from backend.models import agent_models, ocd_models, adhd_models
from backend.services.agent_tools import ToolContext, _start_erp_session
from backend.tests.conftest import FakeFunctionCall, FakePart, FakeResponse


def _make_conversation(db, user_id):
    conv = agent_models.AgentConversation(user_id=user_id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def test_confirmed_create_exposure_persists_and_logs(login_as, user_a):
    client = login_as(user_a)
    db = SessionLocal()
    try:
        conv = _make_conversation(db, user_a.id)
    finally:
        db.close()

    response = client.post(
        "/api/agent/tool/execute",
        json={
            "conversation_id": conv.id,
            "tool_name": "create_exposure",
            "tool_args": {"description": "Touch a doorknob", "category": "contamination"},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "executed"

    db = SessionLocal()
    try:
        hierarchies = db.query(ocd_models.ExposureHierarchy).filter_by(owner_id=user_a.id).all()
        assert len(hierarchies) == 1
        assert hierarchies[0].tasks[0].description == "Touch a doorknob"

        logs = db.query(agent_models.AgentActionLog).filter_by(user_id=user_a.id, tool_name="create_exposure").all()
        assert any(l.status == "executed" for l in logs)

        outcomes = db.query(agent_models.InterventionOutcome).filter_by(user_id=user_a.id).all()
        assert len(outcomes) == 1
        assert outcomes[0].module == "ocd"
    finally:
        db.close()


def test_execute_endpoint_rejects_conversation_owned_by_another_user(login_as, user_a, user_b):
    db = SessionLocal()
    try:
        conv = _make_conversation(db, user_a.id)
    finally:
        db.close()

    client_b = login_as(user_b)
    response = client_b.post(
        "/api/agent/tool/execute",
        json={"conversation_id": conv.id, "tool_name": "create_exposure", "tool_args": {"description": "x"}},
    )
    assert response.status_code == 404


def test_execute_endpoint_reports_error_for_missing_required_args(login_as, user_a):
    client = login_as(user_a)
    db = SessionLocal()
    try:
        conv = _make_conversation(db, user_a.id)
    finally:
        db.close()

    response = client.post(
        "/api/agent/tool/execute",
        json={"conversation_id": conv.id, "tool_name": "create_exposure", "tool_args": {}},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "error"


def test_full_confirmation_chain_request_propose_confirm_revalidate_write(login_as, user_a, install_fake_gemini):
    """REQUEST -> PENDING_CONFIRMATION -> USER CONFIRMS -> SERVER REVALIDATES -> ACTUAL WRITE,
    driven through the real HTTP endpoints exactly as the frontend would call them."""
    tool_call = FakeResponse(
        parts=[FakePart(function_call=FakeFunctionCall("create_task_breakdown", {"task": "Finish my essay"}))]
    )
    install_fake_gemini([tool_call])

    client = login_as(user_a)

    chat_response = client.post("/api/agent/chat", json={"message": "break down my essay task"})
    assert chat_response.status_code == 200
    chat_body = chat_response.json()
    assert chat_body["action_payload"]["type"] == "PENDING_CONFIRMATION"
    assert chat_body["action_payload"]["tool_name"] == "create_task_breakdown"
    conversation_id = chat_body["conversation_id"]

    # Nothing written yet — this is the "propose" half only.
    db = SessionLocal()
    try:
        assert db.query(adhd_models.TaskBreakdown).filter_by(user_id=user_a.id).count() == 0
    finally:
        db.close()

    execute_response = client.post(
        "/api/agent/tool/execute",
        json={
            "conversation_id": conversation_id,
            "tool_name": chat_body["action_payload"]["tool_name"],
            "tool_args": chat_body["action_payload"]["tool_args"],
        },
    )
    assert execute_response.status_code == 200
    assert execute_response.json()["status"] == "executed"

    db = SessionLocal()
    try:
        breakdowns = db.query(adhd_models.TaskBreakdown).filter_by(user_id=user_a.id).all()
        assert len(breakdowns) == 1
        assert breakdowns[0].original_task == "Finish my essay"
    finally:
        db.close()


def test_cancelling_a_pending_confirmation_performs_no_write(login_as, user_a, install_fake_gemini):
    """Cancellation is a pure frontend-local action (no endpoint call) — proving that
    simply never calling /tool/execute leaves the database completely untouched."""
    tool_call = FakeResponse(
        parts=[FakePart(function_call=FakeFunctionCall("create_exposure", {"description": "Ride an elevator"}))]
    )
    install_fake_gemini([tool_call])

    client = login_as(user_a)
    chat_response = client.post("/api/agent/chat", json={"message": "add riding an elevator to my exposures"})
    assert chat_response.json()["action_payload"]["type"] == "PENDING_CONFIRMATION"

    # User clicks "Cancel" — the frontend never calls /tool/execute at all.
    db = SessionLocal()
    try:
        assert db.query(ocd_models.ExposureHierarchy).filter_by(owner_id=user_a.id).count() == 0
        logs = db.query(agent_models.AgentActionLog).filter_by(user_id=user_a.id, tool_name="create_exposure").all()
        assert all(l.status != "executed" for l in logs)
    finally:
        db.close()


def test_complete_erp_session_requires_confirmation_and_only_writes_after_it(user_a, install_fake_gemini):
    db = SessionLocal()
    try:
        session = _start_erp_session(
            {"exposure_description": "Touch a doorknob", "pre_suds": 60}, ToolContext(db=db, user=user_a)
        )
    finally:
        db.close()

    from backend.services import agent_service

    tool_call = FakeResponse(
        parts=[FakePart(function_call=FakeFunctionCall(
            "complete_erp_session", {"session_id": session["session_id"], "post_suds": 15, "resisted_compulsion": True}
        ))]
    )
    install_fake_gemini([tool_call])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("I'm done, SUDS dropped to 15 and I resisted")
        still_in_progress = db.query(ocd_models.ERPSession).filter_by(id=session["session_id"]).one()
    finally:
        db.close()

    assert result["action"]["type"] == "PENDING_CONFIRMATION"
    assert still_in_progress.status == "in_progress"
    assert still_in_progress.post_suds is None
