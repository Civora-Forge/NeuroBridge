"""
Discovered via a live manual run: when a real tool call succeeds but the
SECOND (follow-up, summarization) Gemini call then fails — quota, timeout,
any transient/non-transient error — the orchestrator used to fall back to a
bare "I understand.", discarding the real data the tool had just returned.
Since the tool's result is real and already in hand, rendering it with the
same deterministic templates fast_path.py already uses is a strictly better
fallback than a content-free platitude.
"""

from backend.database import SessionLocal
from backend.models import adhd_models
from backend.services import agent_service
from backend.tests.conftest import FakeFunctionCall, FakePart


class _NoTextResponse:
    """Mirrors the real google-generativeai SDK: accessing .text on a
    function-call-only response raises, rather than returning "" (the
    shared FakeResponse fixture's default) — this is what actually happens
    in production when the round loop breaks mid-turn."""

    def __init__(self, parts):
        class _Content:
            pass
        content = _Content()
        content.parts = parts

        class _Candidate:
            pass
        candidate = _Candidate()
        candidate.content = content
        self.candidates = [candidate]

    @property
    def text(self):
        raise ValueError("no text in a function-call-only response")


class _FailSecondCallChat:
    def __init__(self, first_response):
        self._first_response = first_response
        self.calls = 0

    def send_message(self, *args, **kwargs):
        self.calls += 1
        if self.calls == 1:
            return self._first_response
        raise RuntimeError("simulated follow-up call failure (e.g. quota exhausted)")


class _FailSecondCallModel:
    def __init__(self, chat):
        self._chat = chat

    def start_chat(self, history=None):
        return self._chat


def test_followup_call_failure_after_a_successful_read_renders_the_real_tool_data_not_a_platitude(user_a, monkeypatch):
    import google.generativeai as genai

    monkeypatch.setattr(agent_service, "api_key", "fake-key")

    db = SessionLocal()
    try:
        db.add(adhd_models.FocusSession(user_id=user_a.id, intent="deep work on report", duration_minutes=25, status="COMPLETED"))
        db.commit()
    finally:
        db.close()

    tool_call = _NoTextResponse(parts=[FakePart(function_call=FakeFunctionCall("get_recent_tasks", {}))])
    chat = _FailSecondCallChat(tool_call)
    monkeypatch.setattr(genai, "GenerativeModel", lambda **kwargs: _FailSecondCallModel(chat))

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        # Deliberately not a fast-path phrase, so this genuinely exercises the LLM round trip.
        result = orchestrator.process_message("what have I been working on lately")
    finally:
        db.close()

    assert result["response"] not in ("I understand.", "Done.")
    # The real seeded data (25 minutes, completed), via fast_path's render_recent_tasks
    # template — not fabricated, not a platitude.
    assert "25 minutes" in result["response"]
    assert "completed" in result["response"]


def test_followup_call_failure_on_a_focus_control_action_renders_the_real_session_state(user_a, monkeypatch):
    """FOCUS_SESSION_CONTROL actions (start/pause/resume/stop/set_duration) get
    their own small deterministic renderer too — real remaining time, not a
    bare 'Done.' — since that data is already sitting right there in the
    tool's real result."""
    import google.generativeai as genai

    monkeypatch.setattr(agent_service, "api_key", "fake-key")

    tool_call = _NoTextResponse(parts=[FakePart(function_call=FakeFunctionCall("start_focus_session", {"duration_minutes": 25}))])
    chat = _FailSecondCallChat(tool_call)
    monkeypatch.setattr(genai, "GenerativeModel", lambda **kwargs: _FailSecondCallModel(chat))

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("start a focus session for me")
    finally:
        db.close()

    assert result["response"] == "Started a 25-minute focus session."


def test_followup_call_failure_on_start_grounding_renders_the_real_exercise_started(user_a, monkeypatch):
    """Discovered from a live user report: the chat text claimed a grounding
    exercise was "started", but a transient follow-up-call failure right
    after the real start_grounding_activity call was silently swallowed into
    a bare 'Done.', leaving the user with no idea what was actually started."""
    import google.generativeai as genai

    monkeypatch.setattr(agent_service, "api_key", "fake-key")

    tool_call = _NoTextResponse(parts=[FakePart(function_call=FakeFunctionCall("start_grounding_activity", {"anxiety_level": 8}))])
    chat = _FailSecondCallChat(tool_call)
    monkeypatch.setattr(genai, "GenerativeModel", lambda **kwargs: _FailSecondCallModel(chat))

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("I am not feeling OK")
    finally:
        db.close()

    assert result["response"] == "Started a 5-4-3-2-1 Senses grounding exercise for you."


def test_followup_call_failure_on_complete_grounding_renders_the_real_before_after(user_a, monkeypatch):
    import google.generativeai as genai

    monkeypatch.setattr(agent_service, "api_key", "fake-key")

    from backend.models import anxiety_models
    db = SessionLocal()
    try:
        session = anxiety_models.GroundingSession(user_id=user_a.id, exercise_type="Box Breathing", pre_anxiety=8)
        db.add(session)
        db.commit()
        db.refresh(session)
        session_id = session.id
    finally:
        db.close()

    tool_call = _NoTextResponse(parts=[FakePart(function_call=FakeFunctionCall(
        "complete_grounding_activity", {"session_id": session_id, "post_anxiety": 3}
    ))])
    chat = _FailSecondCallChat(tool_call)
    monkeypatch.setattr(genai, "GenerativeModel", lambda **kwargs: _FailSecondCallModel(chat))

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("that helped, I'm at a 3 now")
    finally:
        db.close()

    assert result["response"] == "Logged your Box Breathing session — anxiety went from 8 to 3."


def test_followup_call_failure_with_truly_no_renderable_tool_falls_back_to_the_old_safe_platitude(user_a, monkeypatch):
    """A write_low tool with neither a fast_path template nor a
    FOCUS_SESSION_CONTROL mapping (record_suds) still gets the honest,
    minimal fallback — proving the new behavior is additive, not a
    regression for tools with no deterministic renderer at all."""
    import google.generativeai as genai

    monkeypatch.setattr(agent_service, "api_key", "fake-key")

    tool_call = _NoTextResponse(parts=[FakePart(function_call=FakeFunctionCall("record_suds", {"value": 40}))])
    chat = _FailSecondCallChat(tool_call)
    monkeypatch.setattr(genai, "GenerativeModel", lambda **kwargs: _FailSecondCallModel(chat))

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("log my suds at 40")
    finally:
        db.close()

    # record_suds has no fast_path template and no _TOOL_ACTION_MAP/FOCUS_SESSION_CONTROL
    # entry at all, so last_action stays None -> the original, most-minimal fallback.
    assert result["response"] == "I understand."
