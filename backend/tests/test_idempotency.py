"""
P1.13 — idempotency for confirmation-gated writes: a duplicate submit/retry
with the same conversation, tool, and arguments must not create a second
record.
"""

from datetime import datetime, timedelta

from backend.database import SessionLocal
from backend.models import agent_models, ocd_models
from backend.services.agent_service import AgentOrchestrator


def test_duplicate_confirm_within_window_does_not_create_a_second_record(user_a):
    db = SessionLocal()
    try:
        conv = agent_models.AgentConversation(user_id=user_a.id)
        db.add(conv)
        db.commit()
        db.refresh(conv)

        orchestrator = AgentOrchestrator(db, user_a)
        args = {"description": "Touch a doorknob", "category": "contamination"}

        first = orchestrator.execute_confirmed_tool("create_exposure", args, conversation_id=conv.id)
        second = orchestrator.execute_confirmed_tool("create_exposure", args, conversation_id=conv.id)

        hierarchies = db.query(ocd_models.ExposureHierarchy).filter_by(owner_id=user_a.id).all()
    finally:
        db.close()

    assert first["status"] == "executed"
    assert first.get("idempotent_replay") is not True
    assert second["status"] == "executed"
    assert second.get("idempotent_replay") is True
    assert len(hierarchies) == 1  # not 2 — the duplicate did not create a second exposure


def test_different_arguments_are_not_treated_as_duplicates(user_a):
    db = SessionLocal()
    try:
        conv = agent_models.AgentConversation(user_id=user_a.id)
        db.add(conv)
        db.commit()
        db.refresh(conv)

        orchestrator = AgentOrchestrator(db, user_a)
        orchestrator.execute_confirmed_tool("create_exposure", {"description": "Touch a doorknob"}, conversation_id=conv.id)
        second = orchestrator.execute_confirmed_tool("create_exposure", {"description": "Use a public restroom"}, conversation_id=conv.id)

        hierarchy = db.query(ocd_models.ExposureHierarchy).filter_by(owner_id=user_a.id).one()
        task_count = len(hierarchy.tasks)  # read while the session is still open
    finally:
        db.close()

    assert second.get("idempotent_replay") is not True
    assert task_count == 2  # both genuinely different exposures were created (same default hierarchy)


def test_duplicate_outside_the_idempotency_window_is_not_blocked(user_a):
    """A request that only LOOKS like a duplicate but happened long enough ago
    should be treated as a fresh, deliberate repeat action, not blocked."""
    db = SessionLocal()
    try:
        conv = agent_models.AgentConversation(user_id=user_a.id)
        db.add(conv)
        db.commit()
        db.refresh(conv)

        orchestrator = AgentOrchestrator(db, user_a)
        args = {"description": "Touch a doorknob"}
        orchestrator.execute_confirmed_tool("create_exposure", args, conversation_id=conv.id)

        # Simulate that the first execution happened well outside the idempotency window.
        old_log = db.query(agent_models.AgentActionLog).filter_by(
            user_id=user_a.id, tool_name="create_exposure", status="executed"
        ).first()
        old_log.created_at = datetime.utcnow() - timedelta(seconds=999)
        db.commit()

        second = orchestrator.execute_confirmed_tool("create_exposure", args, conversation_id=conv.id)
        hierarchy = db.query(ocd_models.ExposureHierarchy).filter_by(owner_id=user_a.id).one()
        task_count = len(hierarchy.tasks)
    finally:
        db.close()

    assert second.get("idempotent_replay") is not True
    assert task_count == 2  # both really ran (same description, same default hierarchy — 2 tasks in it)


def test_idempotency_is_scoped_per_conversation_not_global(user_a):
    """The same tool+args in a DIFFERENT conversation is a legitimately separate
    action, not a duplicate of the first."""
    db = SessionLocal()
    try:
        conv1 = agent_models.AgentConversation(user_id=user_a.id)
        conv2 = agent_models.AgentConversation(user_id=user_a.id)
        db.add_all([conv1, conv2])
        db.commit()
        db.refresh(conv1)
        db.refresh(conv2)

        orchestrator = AgentOrchestrator(db, user_a)
        args = {"description": "Touch a doorknob"}
        orchestrator.execute_confirmed_tool("create_exposure", args, conversation_id=conv1.id)
        second = orchestrator.execute_confirmed_tool("create_exposure", args, conversation_id=conv2.id)

        # Same description/category defaults merge into one hierarchy — that's
        # _create_exposure's own grouping logic, unrelated to idempotency. What
        # matters here is that BOTH really executed (2 tasks), not how they're grouped.
        hierarchy = db.query(ocd_models.ExposureHierarchy).filter_by(owner_id=user_a.id).one()
        task_count = len(hierarchy.tasks)
    finally:
        db.close()

    assert second.get("idempotent_replay") is not True
    assert task_count == 2
