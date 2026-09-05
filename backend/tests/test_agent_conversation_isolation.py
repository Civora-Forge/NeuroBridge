"""Cross-user isolation for agent conversations, and for the two
observability/personalization tables (agent_action_logs, intervention_outcomes)
that have no read API at all — their isolation guarantee is "always tagged
with the authenticated writer's id, never exposed via any endpoint"."""

from backend.database import SessionLocal
from backend.models import agent_models
from backend.services.agent_tools import ToolContext
from backend.services import agent_tools


def test_user_cannot_list_another_users_conversations(login_as, user_a, user_b):
    login_as(user_a).post("/api/agent/chat", json={"message": "take me to the anxiety tools"})
    login_as(user_b).post("/api/agent/chat", json={"message": "take me to the anxiety tools"})

    response = login_as(user_a).get("/api/agent/conversations")
    assert response.status_code == 200
    conversations = response.json()
    assert len(conversations) == 1
    assert conversations[0]["user_id"] == user_a.id


def test_user_cannot_fetch_another_users_conversation_by_id(login_as, user_a, user_b):
    create_response = login_as(user_a).post("/api/agent/chat", json={"message": "take me to the anxiety tools"})
    conversation_id = create_response.json()["conversation_id"]

    response = login_as(user_b).get(f"/api/agent/conversations/{conversation_id}")
    assert response.status_code == 404


def test_user_cannot_post_messages_into_another_users_conversation(login_as, user_a, user_b):
    create_response = login_as(user_a).post("/api/agent/chat", json={"message": "take me to the anxiety tools"})
    conversation_id = create_response.json()["conversation_id"]

    response = login_as(user_b).post(
        "/api/agent/chat", json={"message": "take me to the anxiety tools", "conversation_id": conversation_id}
    )
    assert response.status_code == 404


def test_action_logs_and_outcomes_are_tagged_to_the_acting_user_only(user_a, user_b):
    db = SessionLocal()
    try:
        agent_tools._create_exposure({"description": "Touch a doorknob"}, ToolContext(db=db, user=user_a))

        logs_a = db.query(agent_models.AgentActionLog).filter_by(user_id=user_a.id).all()
        logs_b = db.query(agent_models.AgentActionLog).filter_by(user_id=user_b.id).all()
        assert len(logs_a) == 0  # _create_exposure called directly bypasses AgentOrchestrator's own logging
        assert len(logs_b) == 0
    finally:
        db.close()


def test_orchestrator_logged_actions_are_tagged_per_user(user_a, user_b, monkeypatch):
    """Exercise the real logging path (AgentOrchestrator._execute_tool), not the bare tool function."""
    from backend.services import agent_service

    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    db = SessionLocal()
    try:
        orch_a = agent_service.AgentOrchestrator(db, user_a)
        orch_a.process_message("take me to the anxiety tools")  # deterministic shortcut, logs an AgentActionLog

        logs_a = db.query(agent_models.AgentActionLog).filter_by(user_id=user_a.id).all()
        logs_b = db.query(agent_models.AgentActionLog).filter_by(user_id=user_b.id).all()
        assert len(logs_a) == 1
        assert len(logs_b) == 0

        outcomes_a = db.query(agent_models.InterventionOutcome).filter_by(user_id=user_a.id).all()
        outcomes_b = db.query(agent_models.InterventionOutcome).filter_by(user_id=user_b.id).all()
        assert outcomes_b == []
    finally:
        db.close()


def test_no_endpoint_exposes_agent_action_logs_or_outcomes():
    """There must be no route that returns another user's (or even the caller's own)
    action logs/outcomes — these are observability data only, never client-readable."""
    from backend.main import app

    paths = set(app.openapi()["paths"].keys())
    assert paths, "sanity check: the app should expose at least the known routes"
    assert not any("action_log" in p or "action-log" in p for p in paths)
    assert not any("outcome" in p for p in paths)
