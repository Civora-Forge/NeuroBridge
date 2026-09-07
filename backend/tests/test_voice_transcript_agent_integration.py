"""
Voice input has no backend representation of its own — by the time a spoken
utterance reaches this server, it is exactly `ChatRequest.message: str`, the
same field a typed message uses (see src/hooks/useAgentVoice.js +
AgentChat.jsx: the browser's Web Speech API produces a transcript string,
which is handed to the SAME agentStore.sendMessage() as typed text — there is
no separate voice endpoint, voice tool, or hardcoded voice command map).

These tests exist to prove that claim stays true: a transcript-shaped message
string is dispatched through the REAL AgentOrchestrator, REAL tools, and a
REAL SQLite DB — nothing here is voice-specific. If someone later "optimizes"
voice by adding a shortcut/keyword map that bypasses the orchestrator, these
tests will not exercise that shortcut and a companion frontend change would
be needed to route around it — making such a regression obvious in review.
"""

from backend.database import SessionLocal
from backend.models import agent_models, adhd_models, ocd_models
from backend.services import agent_service
from backend.services.agent_state import ExecutionState
from backend.tests.conftest import FakeFunctionCall, FakePart, FakeResponse


def test_voice_transcript_uses_real_agent_orchestrator(user_a, install_fake_gemini):
    """A natural, punctuated, voice-shaped transcript ('Can you check what I've
    been focusing on lately?') is not a fast-path phrase and not a canned
    command — it must go through real Gemini function-calling and dispatch a
    real tool against real (seeded) data, exactly like typed input would."""
    db = SessionLocal()
    try:
        db.add(adhd_models.FocusSession(user_id=user_a.id, intent="deep work on report", duration_minutes=25, status="completed"))
        db.commit()

        tool_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("get_recent_tasks", {}))])
        final = FakeResponse(parts=[FakePart()], text="You recently focused on deep work for 25 minutes.")
        install_fake_gemini([tool_call, final])

        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        events = []
        voice_transcript = "Can you check what I've been focusing on lately?"
        result = orchestrator.process_message(voice_transcript, on_event=lambda e: events.append(e))

        action_log = db.query(agent_models.AgentActionLog).filter_by(
            user_id=user_a.id, tool_name="get_recent_tasks", status="executed"
        ).first()
        assert action_log is not None  # the REAL tool actually ran, not a stub
        assert result["state"] == ExecutionState.COMPLETED.value
        assert "25 minutes" in result["response"]
        assert [e["type"] for e in events][:3] == ["execution_started", "state_changed", "state_changed"]
        assert "tool_started" in [e["type"] for e in events]
    finally:
        db.close()


def test_voice_transcript_multi_step_dynamic_replanning_depends_on_the_real_first_result(user_a, install_fake_gemini_reactive):
    """'I can't start my assignment. Can you help me?' spoken aloud must trigger
    genuine multi-step reasoning: the SECOND tool choice depends on the ACTUAL
    result of the first, not a scripted sequence. Proven the same way as the
    typed-input dynamic re-planning tests, using a voice-shaped transcript."""
    db = SessionLocal()
    try:
        assert db.query(adhd_models.TaskBreakdown).filter_by(user_id=user_a.id).count() == 0

        def responder(call_index: int, payload):
            if call_index == 0:
                return FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("get_recent_tasks", {}))])
            if call_index == 1:
                fr = payload.parts[0].function_response
                result = dict(fr.response.get("result"))
                # The second tool is chosen BECAUSE the real result showed no existing breakdowns.
                assert result["recent_task_breakdowns"] == []
                return FakeResponse(parts=[FakePart(function_call=FakeFunctionCall(
                    "create_task_breakdown", {"task": "the assignment I'm stuck on"}
                ))])
            raise AssertionError("unexpected extra LLM round trip")

        install_fake_gemini_reactive(responder)

        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("I can't start my assignment. Can you help me?")

        tool_sequence = [
            log.tool_name for log in
            db.query(agent_models.AgentActionLog).filter_by(user_id=user_a.id).order_by(agent_models.AgentActionLog.id).all()
        ]
        assert tool_sequence == ["get_recent_tasks", "create_task_breakdown"]
        assert result["state"] == ExecutionState.CONFIRMATION_REQUIRED.value  # write still gated
    finally:
        db.close()


def test_voice_write_confirm_cancel_performs_zero_db_writes(user_a, install_fake_gemini):
    """Spoken: 'Add an exposure for touching a public door handle.' Must stop at
    CONFIRMATION_REQUIRED without writing anything — voice must not fast-track
    a write just because it arrived as speech instead of text."""
    db = SessionLocal()
    try:
        tool_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall(
            "create_exposure", {"description": "touching a public door handle", "category": "contamination"}
        ))])
        install_fake_gemini([tool_call])

        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("Add an exposure for touching a public door handle.")

        assert result["state"] == ExecutionState.CONFIRMATION_REQUIRED.value
        assert db.query(ocd_models.ExposureTask).count() == 0  # nothing written yet

        # User says "cancel" out loud — the frontend just discards pendingConfirmation
        # locally (cancelPendingAction) and never calls /tool/execute at all.
        # Confirm that assumption: without a call to execute_confirmed_tool, still zero writes.
        assert db.query(ocd_models.ExposureTask).count() == 0
    finally:
        db.close()


def test_voice_write_confirm_then_confirm_performs_exactly_one_write_and_is_idempotent(user_a, install_fake_gemini):
    """Same spoken request, but the user confirms this time: exactly one real
    write happens, and a duplicate confirm (e.g. a flaky mic double-submit)
    does not create a second one."""
    db = SessionLocal()
    try:
        tool_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall(
            "create_exposure", {"description": "touching a public door handle", "category": "contamination"}
        ))])
        install_fake_gemini([tool_call])

        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        proposal = orchestrator.process_message("Add an exposure for touching a public door handle.")
        assert proposal["state"] == ExecutionState.CONFIRMATION_REQUIRED.value
        tool_args = proposal["action"]["tool_args"]

        first = orchestrator.execute_confirmed_tool("create_exposure", tool_args, conversation_id=1)
        assert first["status"] == "executed"
        assert db.query(ocd_models.ExposureTask).count() == 1

        # Duplicate confirm (same conversation, same args, within the idempotency window).
        second = orchestrator.execute_confirmed_tool("create_exposure", tool_args, conversation_id=1)
        assert second.get("idempotent_replay") is True
        assert db.query(ocd_models.ExposureTask).count() == 1  # still exactly one
    finally:
        db.close()
