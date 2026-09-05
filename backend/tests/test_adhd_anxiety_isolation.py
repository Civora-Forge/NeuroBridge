"""Cross-user isolation for ADHD and Anxiety — the two modules whose FastAPI
tables previously existed only as an unfiltered write sink for the old agent
prototype (nothing ever read them back, so this is new-in-this-pass coverage)."""

from backend.database import SessionLocal
from backend.services import agent_tools
from backend.services.agent_tools import ToolContext


def test_adhd_get_recent_tasks_only_returns_own_data(user_a, user_b):
    db = SessionLocal()
    try:
        ctx_a = ToolContext(db=db, user=user_a)
        agent_tools._create_task_breakdown({"task": "Write the report"}, ctx_a)
        agent_tools._start_focus_session({"intent": "deep work", "duration_minutes": 25}, ctx_a)

        ctx_b = ToolContext(db=db, user=user_b)
        recent_b = agent_tools._get_recent_tasks({}, ctx_b)
        assert recent_b["recent_task_breakdowns"] == []
        assert recent_b["recent_focus_sessions"] == []

        recent_a = agent_tools._get_recent_tasks({}, ctx_a)
        assert len(recent_a["recent_task_breakdowns"]) == 1
        assert len(recent_a["recent_focus_sessions"]) == 1
    finally:
        db.close()


def test_adhd_rest_endpoints_are_isolated_per_user(login_as, user_a, user_b):
    db = SessionLocal()
    try:
        agent_tools._create_task_breakdown({"task": "Write the report"}, ToolContext(db=db, user=user_a))
        agent_tools._start_focus_session({"intent": "deep work"}, ToolContext(db=db, user=user_a))
    finally:
        db.close()

    response = login_as(user_b).get("/api/adhd/tasks")
    assert response.status_code == 200
    assert response.json() == []

    response = login_as(user_b).get("/api/adhd/focus-sessions")
    assert response.status_code == 200
    assert response.json() == []

    response = login_as(user_a).get("/api/adhd/tasks")
    assert len(response.json()) == 1


def test_anxiety_get_history_only_returns_own_data(user_a, user_b):
    db = SessionLocal()
    try:
        ctx_a = ToolContext(db=db, user=user_a)
        agent_tools._start_grounding_activity({"anxiety_level": 8}, ctx_a)

        ctx_b = ToolContext(db=db, user=user_b)
        history_b = agent_tools._get_anxiety_history({}, ctx_b)
        assert history_b["recent_grounding_sessions"] == []

        history_a = agent_tools._get_anxiety_history({}, ctx_a)
        assert len(history_a["recent_grounding_sessions"]) == 1
    finally:
        db.close()


def test_anxiety_rest_endpoint_is_isolated_per_user(login_as, user_a, user_b):
    db = SessionLocal()
    try:
        agent_tools._start_grounding_activity({"anxiety_level": 9}, ToolContext(db=db, user=user_a))
    finally:
        db.close()

    response = login_as(user_b).get("/api/anxiety/grounding-sessions")
    assert response.status_code == 200
    assert response.json() == []

    response = login_as(user_a).get("/api/anxiety/grounding-sessions")
    assert len(response.json()) == 1
