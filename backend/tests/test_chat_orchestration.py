"""
End-to-end orchestration tests with a mocked Gemini client (no live API key
needed, no network). Exercises the real tool-dispatch / confirmation-policy /
multi-step-chaining code path in AgentOrchestrator.process_message — only the
LLM call itself is faked.
"""

from backend.database import SessionLocal
from backend.models import agent_models, adhd_models
from backend.services import agent_service
from backend.services.agent_tools import TOOL_REGISTRY
from backend.tests.conftest import FakeFunctionCall, FakePart, FakeResponse


def test_read_tool_executes_automatically_and_final_text_is_used(user_a, install_fake_gemini):
    tool_call_response = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("get_ocd_progress", {}))])
    final_response = FakeResponse(parts=[FakePart()], text="You have 0 exposure hierarchies so far.")
    install_fake_gemini([tool_call_response, final_response])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("how am I doing with my ERP practice?")
    finally:
        db.close()

    assert "0 exposure hierarchies" in result["response"]
    assert result["action"] is None


def test_write_confirm_tool_is_proposed_not_executed(user_a, install_fake_gemini):
    tool_call_response = FakeResponse(
        parts=[FakePart(function_call=FakeFunctionCall("create_exposure", {"description": "Touch a doorknob"}))]
    )
    install_fake_gemini([tool_call_response])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("add touching a doorknob to my exposure list")

        from backend.models import ocd_models
        hierarchies = db.query(ocd_models.ExposureHierarchy).filter_by(owner_id=user_a.id).all()
    finally:
        db.close()

    assert hierarchies == []  # never actually executed
    assert result["action"]["type"] == "PENDING_CONFIRMATION"
    assert result["action"]["tool_name"] == "create_exposure"


def test_every_registered_tool_has_a_handler_and_valid_schema():
    for name, tool in TOOL_REGISTRY.items():
        assert tool.handler is not None
        assert tool.parameters["type"] == "object"
        assert callable(tool.handler)


def test_multistep_cant_start_assignment_retrieves_context_then_breaks_down_task(user_a, install_fake_gemini):
    """"I can't start my assignment" must actually retrieve context and produce a real
    task breakdown proposal — not just a text recommendation to "try breaking it down"."""
    step1_calls_get_recent_tasks = FakeResponse(
        parts=[FakePart(function_call=FakeFunctionCall("get_recent_tasks", {}))]
    )
    step2_calls_create_breakdown = FakeResponse(
        parts=[FakePart(function_call=FakeFunctionCall("create_task_breakdown", {"task": "Finish the assignment"}))]
    )
    install_fake_gemini([step1_calls_get_recent_tasks, step2_calls_create_breakdown])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("I have an assignment due tomorrow and haven't started")

        breakdowns = db.query(adhd_models.TaskBreakdown).filter_by(user_id=user_a.id).all()
        logs = db.query(agent_models.AgentActionLog).filter_by(user_id=user_a.id).order_by(agent_models.AgentActionLog.id).all()
    finally:
        db.close()

    # get_recent_tasks (context retrieval) really ran, then create_task_breakdown was really proposed —
    # this proves the retrieve-context -> plan -> propose-action chain, not a single canned reply.
    assert [l.tool_name for l in logs] == ["get_recent_tasks", "create_task_breakdown"]
    assert logs[0].status == "executed"
    assert logs[1].status == "pending_confirmation"
    assert breakdowns == []  # write_confirm — not executed until the user confirms
    assert result["action"]["type"] == "PENDING_CONFIRMATION"
    assert result["action"]["tool_name"] == "create_task_breakdown"


def test_multistep_fully_automatic_read_then_write_low_chain(user_a, install_fake_gemini):
    """A read tool followed by a write_low tool should chain fully automatically —
    genuinely starting a real focus session, not merely recommending one."""
    step1 = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("get_recent_tasks", {}))])
    step2 = FakeResponse(
        parts=[FakePart(function_call=FakeFunctionCall("start_focus_session", {"intent": "assignment", "duration_minutes": 15}))]
    )
    final = FakeResponse(parts=[FakePart()], text="I've started a 15 minute focus session for you.")
    install_fake_gemini([step1, step2, final])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("help me get started on my assignment")

        sessions = db.query(adhd_models.FocusSession).filter_by(user_id=user_a.id).all()
    finally:
        db.close()

    assert len(sessions) == 1
    assert sessions[0].duration_minutes == 15
    assert result["action"]["type"] == "NAVIGATE_WITH_DATA"
    assert result["action"]["card_type"] == "FOCUS_SESSION"


def test_agent_never_reports_success_when_the_tool_actually_failed(user_a, install_fake_gemini):
    """record_suds against a session_id owned by nobody (doesn't exist) must fail — and the
    final reply must carry a corrective note, regardless of what Gemini's own text said.
    (record_suds is write_low, so it genuinely auto-executes and can genuinely fail here —
    unlike a write_confirm tool, which would just stop at the proposal stage instead.)"""
    tool_call = FakeResponse(
        parts=[FakePart(function_call=FakeFunctionCall("record_suds", {"session_id": 999999, "value": 10}))]
    )
    # Simulate an LLM that (wrongly) claims success despite being told the tool errored.
    final = FakeResponse(parts=[FakePart()], text="Great, I've logged that SUDS reading for you.")
    install_fake_gemini([tool_call, final])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("log my SUDS at 10 for that session")
    finally:
        db.close()

    assert "didn't go through" in result["response"] or "wasn't able" in result["response"].lower()
    assert result["action"] is None


def test_execute_confirmed_tool_rejects_non_write_confirm_tools(user_a):
    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        outcome = orchestrator.execute_confirmed_tool("get_ocd_progress", {})
    finally:
        db.close()
    assert outcome["status"] == "denied"
