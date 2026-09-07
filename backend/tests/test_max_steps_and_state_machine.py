"""
P0.3 (max-step termination must not silently stop) and P0.4 (explicit,
backend-owned AgentExecution state machine).
"""

from backend.database import SessionLocal
from backend.models import agent_models
from backend.services import agent_service
from backend.services.agent_state import ExecutionState
from backend.tests.conftest import FakeFunctionCall, FakePart, FakeResponse


def test_max_steps_reached_returns_failed_not_silent(user_a, install_fake_gemini, monkeypatch):
    """If Gemini keeps requesting tools forever, hitting AGENT_MAX_STEPS must
    surface as a structured FAILED state with a safe explanation — never a
    silent stop that pretends nothing happened."""
    monkeypatch.setattr(agent_service, "MAX_TOOL_ROUNDS", 2)
    endless_calls = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("get_ocd_progress", {}))])
    install_fake_gemini([endless_calls, endless_calls, endless_calls, endless_calls])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("keep checking forever")
        error_logs = db.query(agent_models.AgentActionLog).filter_by(
            user_id=user_a.id, status="error", error_message="max_steps_reached"
        ).all()
    finally:
        db.close()

    assert result["state"] == "FAILED"
    assert "more steps" in result["response"].lower() or "try" in result["response"].lower()
    assert len(error_logs) == 1  # the cap being hit is itself logged


def test_execution_row_created_and_reaches_completed(user_a, install_fake_gemini):
    final = FakeResponse(parts=[FakePart()], text="Sure thing.")
    install_fake_gemini([final])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("just chatting, no tool needed")
        execution = db.query(agent_models.AgentExecution).filter_by(execution_id=result["execution_id"]).one()
    finally:
        db.close()

    assert execution.state == ExecutionState.COMPLETED.value
    assert execution.user_id == user_a.id
    assert execution.llm_call_count == 1
    assert execution.started_at is not None
    assert execution.completed_at is not None
    assert execution.total_latency_ms is not None


def test_execution_reaches_confirmation_required_state(user_a, install_fake_gemini):
    tool_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("create_exposure", {"description": "x"}))])
    install_fake_gemini([tool_call])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("add an exposure")
        execution = db.query(agent_models.AgentExecution).filter_by(execution_id=result["execution_id"]).one()
    finally:
        db.close()

    assert execution.state == ExecutionState.CONFIRMATION_REQUIRED.value
    assert execution.tool_name == "create_exposure"


def test_execution_reaches_failed_state_on_llm_error(user_a, monkeypatch):
    from backend.services import agent_service as svc

    monkeypatch.setattr(svc, "api_key", "fake-key")

    class BoomModel:
        def start_chat(self, history=None):
            raise RuntimeError("boom")

    import google.generativeai as genai
    monkeypatch.setattr(genai, "GenerativeModel", lambda **kwargs: BoomModel())

    db = SessionLocal()
    try:
        orchestrator = svc.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("hello")
        execution = db.query(agent_models.AgentExecution).filter_by(execution_id=result["execution_id"]).one()
    finally:
        db.close()

    assert result["state"] == "FAILED"
    assert execution.state == ExecutionState.FAILED.value
    assert execution.error == "llm_call_failed"


def test_an_unexpected_internal_error_still_returns_a_safe_failed_response_not_a_crash(user_a, monkeypatch):
    """Guards the safety-net wrapper added around process_message(): a bug or DB
    hiccup anywhere in the turn (simulated here in context building, a spot with
    no existing try/except of its own) must never propagate as a raw exception
    to the caller, and the execution row must still reach a terminal state."""
    from backend.services import agent_service as svc, context_scope

    def _boom(message):
        raise RuntimeError("simulated unexpected failure")

    monkeypatch.setattr(svc, "api_key", "fake-key")
    monkeypatch.setattr(context_scope, "infer_relevant_modules", _boom)

    db = SessionLocal()
    try:
        orchestrator = svc.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("hello")  # must not raise
        execution = db.query(agent_models.AgentExecution).filter_by(execution_id=result["execution_id"]).one()
    finally:
        db.close()

    assert result["state"] == "FAILED"
    assert "went wrong" in result["response"].lower()
    assert execution.state == ExecutionState.FAILED.value
    assert execution.completed_at is not None  # reached a terminal state, not stuck


def test_frontend_never_needs_to_infer_state_from_prose():
    """Sanity check on the contract itself: every process_message() return value
    carries a real `state` field pulled from the enum, not derived from `response` text."""
    valid_states = {s.value for s in ExecutionState}
    # Exercised indirectly by the other tests in this file — this asserts the enum
    # itself matches the spec's required state set exactly (no drift).
    assert valid_states == {
        "IDLE", "UNDERSTANDING", "PLANNING", "EXECUTING", "WAITING_FOR_TOOL",
        "WAITING_FOR_USER", "CONFIRMATION_REQUIRED", "COMPLETED", "FAILED",
    }
