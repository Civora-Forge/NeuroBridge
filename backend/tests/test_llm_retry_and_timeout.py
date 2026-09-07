"""
P1.11/P1.12 — explicit timeouts on Gemini/tool calls, and at most one retry
for genuinely transient errors only.
"""

from google.api_core.exceptions import DeadlineExceeded

from backend.database import SessionLocal
from backend.models import agent_models
from backend.services import agent_service
from backend.services.agent_tools import TOOL_REGISTRY
from backend.tests.conftest import FakePart, FakeResponse


class _FlakyFakeChat:
    def __init__(self, exc, then_response):
        self._exc = exc
        self._then_response = then_response
        self.calls = 0

    def send_message(self, *args, **kwargs):
        self.calls += 1
        if self.calls == 1:
            raise self._exc
        return self._then_response


class _FlakyFakeModel:
    def __init__(self, chat):
        self._chat = chat

    def start_chat(self, history=None):
        return self._chat


def test_transient_llm_error_is_retried_once_and_succeeds(user_a, monkeypatch):
    import google.generativeai as genai

    monkeypatch.setattr(agent_service, "api_key", "fake-key")
    chat = _FlakyFakeChat(DeadlineExceeded("timed out"), FakeResponse(parts=[FakePart()], text="Got there eventually."))
    monkeypatch.setattr(genai, "GenerativeModel", lambda **kwargs: _FlakyFakeModel(chat))

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("hello")
        execution = db.query(agent_models.AgentExecution).filter_by(execution_id=result["execution_id"]).one()
    finally:
        db.close()

    assert result["state"] == "COMPLETED"
    assert chat.calls == 2  # one failure, one retry
    assert execution.retry_count == 1


def test_non_transient_llm_error_is_not_retried(user_a, monkeypatch):
    import google.generativeai as genai

    monkeypatch.setattr(agent_service, "api_key", "fake-key")
    chat = _FlakyFakeChat(ValueError("bad arguments"), FakeResponse(parts=[FakePart()], text="should never get here"))
    monkeypatch.setattr(genai, "GenerativeModel", lambda **kwargs: _FlakyFakeModel(chat))

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("hello")
    finally:
        db.close()

    assert result["state"] == "FAILED"
    assert chat.calls == 1  # no retry for a non-transient error


def test_tool_that_hangs_past_the_timeout_fails_gracefully(user_a, monkeypatch):
    import time as time_module

    monkeypatch.setattr(agent_service, "TOOL_TIMEOUT_S", 0.05)
    slow_tool = TOOL_REGISTRY["get_ocd_progress"]
    monkeypatch.setattr(slow_tool, "handler", lambda args, ctx: (time_module.sleep(0.5), {})[1])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        outcome = orchestrator._execute_tool(slow_tool, {})
        log = db.query(agent_models.AgentActionLog).filter_by(user_id=user_a.id, tool_name="get_ocd_progress").first()
    finally:
        db.close()

    assert outcome["status"] == "error"
    assert "timed out" in outcome["error"].lower()
    assert log.status == "error"
