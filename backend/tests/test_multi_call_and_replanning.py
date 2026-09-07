"""
P0 correctness fixes:
  1. ALL function calls in one Gemini response are processed, not just the first.
  2. Independent reads in one round execute and get batched into ONE follow-up call.
  3. THE CRITICAL TEST: a real tool's real result changes the next tool decision —
     not a hardcoded `if test_case == A` branch in the orchestrator.
"""

from backend.database import SessionLocal
from backend.models import agent_models, ocd_models
from backend.services import agent_service
from backend.services.agent_tools import ToolContext, _create_exposure
from backend.tests.conftest import FakeFunctionCall, FakePart, FakeResponse


def _proto_result(payload):
    """Read back the real function_response payload a Content carries, the same
    way a real Gemini follow-up call would receive it."""
    fr = payload.parts[0].function_response
    return fr.name, dict(fr.response.get("result"))


def test_all_function_calls_in_one_response_are_executed_not_just_the_first(user_a, install_fake_gemini):
    """Gemini can legitimately return multiple simultaneous function calls in one
    response (e.g. "give me an overview" -> 3 independent reads at once). All of
    them must run — dropping all but the first is a real correctness bug."""
    multi_call = FakeResponse(
        parts=[
            FakePart(function_call=FakeFunctionCall("get_ocd_progress", {})),
            FakePart(function_call=FakeFunctionCall("get_recent_tasks", {})),
            FakePart(function_call=FakeFunctionCall("get_anxiety_history", {})),
        ]
    )
    final = FakeResponse(parts=[FakePart()], text="Here's your overview.")
    call_log, _ = install_fake_gemini([multi_call, final])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("give me a full overview of everything")
        logs = (
            db.query(agent_models.AgentActionLog)
            .filter_by(user_id=user_a.id)
            .filter(agent_models.AgentActionLog.tool_name.isnot(None))
            .all()
        )
    finally:
        db.close()

    executed_tool_names = {l.tool_name for l in logs}
    assert executed_tool_names == {"get_ocd_progress", "get_recent_tasks", "get_anxiety_history"}
    assert result["state"] == "COMPLETED"

    # Initial decision call + exactly ONE batched follow-up carrying all 3 results —
    # not 3 separate round trips (one per tool).
    assert len(call_log) == 2
    follow_up_content = call_log[1][0]
    assert len(follow_up_content.parts) == 3


def test_two_llm_calls_total_for_a_two_tool_parallel_round(user_a, install_fake_gemini):
    """Confirms the round-trip savings directly: 2 independent tools requested
    together cost 2 LLM calls total (initial decide + 1 batched follow-up),
    not 3 (one extra round trip per tool)."""
    multi_call = FakeResponse(
        parts=[
            FakePart(function_call=FakeFunctionCall("get_ocd_progress", {})),
            FakePart(function_call=FakeFunctionCall("get_recent_tasks", {})),
        ]
    )
    final = FakeResponse(parts=[FakePart()], text="Done.")
    call_log, _ = install_fake_gemini([multi_call, final])

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        orchestrator.process_message("show me my ocd and adhd overview together")
    finally:
        db.close()

    # 2 LLM calls total: the initial decision + exactly one batched follow-up (not one per tool).
    assert len(call_log) == 2


def test_dynamic_replanning_tool1_result_changes_tool2_selection_no_hierarchy(user_a, install_fake_gemini_reactive):
    """CRITICAL TEST (spec Phase 12): tool 1's REAL result must change tool 2's
    selection. This is not `if test_case == A: tool2A` — the SAME responder
    function is reused in the sibling test below with different real seeded
    data, and it branches on the actual observed result each time."""

    def responder(call_index, payload):
        if call_index == 0:
            return FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("get_ocd_progress", {}))])
        name, result = _proto_result(payload)
        assert name == "get_ocd_progress"
        if result.get("hierarchy_count", 0) == 0:
            return FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("create_exposure", {"description": "Touch a doorknob"}))])
        return FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("get_recent_tasks", {}))])

    install_fake_gemini_reactive(responder)

    db = SessionLocal()
    try:
        # user_a has NO exposure hierarchy -> real get_ocd_progress returns hierarchy_count=0
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("how am I doing, and what should I do next?")
    finally:
        db.close()

    assert result["action"]["type"] == "PENDING_CONFIRMATION"
    assert result["action"]["tool_name"] == "create_exposure"


def test_dynamic_replanning_tool1_result_changes_tool2_selection_has_hierarchy(user_a, install_fake_gemini_reactive):
    """Sibling of the test above: identical responder logic, but this time the
    REAL database has an existing hierarchy, so the REAL tool result differs —
    and the orchestrator must follow the different branch as a result."""

    def responder(call_index, payload):
        if call_index == 0:
            return FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("get_ocd_progress", {}))])
        name, result = _proto_result(payload)
        assert name == "get_ocd_progress"
        if result.get("hierarchy_count", 0) == 0:
            return FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("create_exposure", {"description": "Touch a doorknob"}))])
        return FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("get_recent_tasks", {}))])

    install_fake_gemini_reactive(responder)

    db = SessionLocal()
    try:
        _create_exposure({"description": "Existing exposure"}, ToolContext(db=db, user=user_a))

        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("how am I doing, and what should I do next?")

        logs = db.query(agent_models.AgentActionLog).filter_by(user_id=user_a.id).order_by(agent_models.AgentActionLog.id).all()
    finally:
        db.close()

    tool_sequence = [l.tool_name for l in logs if l.tool_name]
    assert "create_exposure" not in tool_sequence  # never proposed this time — different real result, different path
    assert "get_recent_tasks" in tool_sequence
    assert result["action"] is None  # get_recent_tasks has no card mapping; a plain completed read
    assert result["state"] == "COMPLETED"
