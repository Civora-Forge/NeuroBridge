"""
P5.21/P5.22 — every execution should be traceable: a unified execution_id
across all tool calls in one turn, and per-step latency instrumentation.
"""

from backend.database import SessionLocal
from backend.models import agent_models
from backend.services import agent_service
from backend.tests.conftest import FakeFunctionCall, FakePart, FakeResponse


def test_all_tool_calls_in_one_turn_share_the_same_execution_id(user_a, install_fake_gemini):
    step1 = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("get_recent_tasks", {}))])
    step2 = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("get_anxiety_history", {}))])
    final = FakeResponse(parts=[FakePart()], text="Here you go.")
    install_fake_gemini([step1, step2, final])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("show me everything")
        logs = db.query(agent_models.AgentActionLog).filter(
            agent_models.AgentActionLog.user_id == user_a.id,
            agent_models.AgentActionLog.tool_name.isnot(None),
        ).all()
    finally:
        db.close()

    assert len(logs) == 2
    assert all(l.execution_id == result["execution_id"] for l in logs)


def test_execution_records_latency_and_call_counts(user_a, install_fake_gemini):
    tool_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("get_recent_tasks", {}))])
    final = FakeResponse(parts=[FakePart()], text="Done.")
    install_fake_gemini([tool_call, final])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("show me my tasks")
        execution = db.query(agent_models.AgentExecution).filter_by(execution_id=result["execution_id"]).one()
    finally:
        db.close()

    assert execution.llm_call_count == 2  # initial decision + one follow-up
    assert execution.tool_call_count == 1
    assert execution.context_retrieval_ms is not None
    assert execution.llm_latency_ms is not None
    assert execution.total_latency_ms is not None
    assert execution.tool_call_count >= 0


def test_action_log_does_not_store_raw_message_text():
    """Observability shouldn't unnecessarily retain sensitive mental-health
    content — AgentActionLog has no free-text message column at all, only
    structured tool_name/args/status."""
    columns = {c.name for c in agent_models.AgentActionLog.__table__.columns}
    assert "message" not in columns
    assert "user_message" not in columns
