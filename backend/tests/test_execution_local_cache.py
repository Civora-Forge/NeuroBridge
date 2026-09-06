"""
P1.7 — execution-local result cache: the same read tool with the same
arguments, requested twice within ONE turn, must only actually execute once.
Never shared across users or across separate turns (that would risk stale
data — this is deliberately scoped to a single AgentOrchestrator instance,
which is itself scoped to one request).
"""

from backend.database import SessionLocal
from backend.services.agent_tools import ToolContext, TOOL_REGISTRY, _create_exposure
from backend.services.agent_service import AgentOrchestrator


def test_repeated_read_tool_call_within_one_turn_hits_cache_not_db(user_a, monkeypatch):
    db = SessionLocal()
    try:
        _create_exposure({"description": "x"}, ToolContext(db=db, user=user_a))
        orchestrator = AgentOrchestrator(db, user_a)

        call_count = {"n": 0}
        real_handler = TOOL_REGISTRY["get_ocd_progress"].handler

        def counting_handler(args, ctx):
            call_count["n"] += 1
            return real_handler(args, ctx)

        monkeypatch.setattr(TOOL_REGISTRY["get_ocd_progress"], "handler", counting_handler)

        tool = TOOL_REGISTRY["get_ocd_progress"]
        first = orchestrator._execute_tool(tool, {})
        second = orchestrator._execute_tool(tool, {})

        assert call_count["n"] == 1  # second call served from the execution-local cache
        assert first == second
    finally:
        db.close()


def test_write_tools_are_never_cached_even_with_identical_args(user_a):
    """Correctness matters more than speed here — a write must always really run."""
    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db, user_a)
        tool = TOOL_REGISTRY["start_grounding_activity"]
        first = orchestrator._execute_tool(tool, {"anxiety_level": 5})
        second = orchestrator._execute_tool(tool, {"anxiety_level": 5})
        assert first["result"]["id"] != second["result"]["id"]  # two real, distinct rows
    finally:
        db.close()


def test_result_cache_is_not_shared_across_orchestrator_instances(user_a, monkeypatch):
    """Different AgentOrchestrator instances (i.e. different requests) must never
    share the execution-local cache — it's per-instance, not module-global."""
    db = SessionLocal()
    try:
        _create_exposure({"description": "x"}, ToolContext(db=db, user=user_a))
        tool = TOOL_REGISTRY["get_ocd_progress"]

        call_count = {"n": 0}
        real_handler = tool.handler

        def counting_handler(args, ctx):
            call_count["n"] += 1
            return real_handler(args, ctx)

        monkeypatch.setattr(tool, "handler", counting_handler)

        AgentOrchestrator(db, user_a)._execute_tool(tool, {})
        AgentOrchestrator(db, user_a)._execute_tool(tool, {})  # fresh instance -> fresh cache

        assert call_count["n"] == 2
    finally:
        db.close()
