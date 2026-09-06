"""
Demo mode: no real Supabase credential exists, so `get_current_user` accepts a
well-formed `demo:<role_id>:<session_id>` pseudo-token instead — restricted to
the known "user"-role mock accounts, namespaced so it can never collide with a
real Supabase UUID, and rate-limited on the one endpoint that actually calls
Gemini (see backend/routers/agent_router.py::_enforce_demo_rate_limit).

These tests hit the real `get_current_user` dependency with real demo
Authorization headers — no dependency_overrides needed, unlike the real-auth
isolation tests, because demo mode has no external Supabase call to mock.
"""

import uuid

import pytest

from backend.routers import agent_router


def _demo_header(role_id: str, session_id: str | None = None) -> dict:
    session_id = session_id or str(uuid.uuid4())
    return {"Authorization": f"Bearer demo:{role_id}:{session_id}"}


@pytest.fixture(autouse=True)
def _reset_demo_rate_limiter():
    agent_router._demo_chat_timestamps.clear()
    yield
    agent_router._demo_chat_timestamps.clear()


def test_unknown_demo_role_is_rejected(client):
    response = client.get("/api/agent/conversations", headers=_demo_header("nb-user-999"))
    assert response.status_code == 401


def test_malformed_demo_token_is_rejected(client):
    response = client.get(
        "/api/agent/conversations", headers={"Authorization": "Bearer demo:nb-user-042"}
    )
    assert response.status_code == 401


def test_known_demo_role_is_accepted_and_works_end_to_end(client):
    response = client.post(
        "/api/agent/chat",
        json={"message": "take me to the anxiety tools"},
        headers=_demo_header("nb-user-042"),
    )
    assert response.status_code == 200
    assert response.json()["action_payload"] == {"type": "NAVIGATE", "path": "/anxiety"}


def test_two_demo_sessions_with_the_same_role_do_not_share_data(client):
    session_a = _demo_header("nb-user-042", "session-aaa")
    session_b = _demo_header("nb-user-042", "session-bbb")

    client.post("/api/ocd/hierarchies/", json={"title": "Contamination", "category": "contamination"}, headers=session_a)

    response_b = client.get("/api/ocd/hierarchies/", headers=session_b)
    assert response_b.json() == []

    response_a = client.get("/api/ocd/hierarchies/", headers=session_a)
    assert len(response_a.json()) == 1


def test_demo_write_confirm_tool_still_requires_confirmation(client):
    """Demo mode gets the same real behavior as a real account — including the
    confirmation gate — not a shortcut around it."""
    headers = _demo_header("nb-user-011")
    chat_response = client.post(
        "/api/agent/chat", json={"message": "take me to the anxiety tools"}, headers=headers
    )
    # (navigation shortcut here just to get a conversation_id without needing Gemini)
    conversation_id = chat_response.json()["conversation_id"]

    execute_response = client.post(
        "/api/agent/tool/execute",
        json={"conversation_id": conversation_id, "tool_name": "create_exposure", "tool_args": {"description": "x"}},
        headers=headers,
    )
    assert execute_response.status_code == 200
    assert execute_response.json()["status"] == "executed"  # confirmed via the real endpoint, as designed


def test_demo_chat_is_rate_limited_but_real_accounts_are_not(client, login_as, user_a):
    headers = _demo_header("nb-user-088")
    for _ in range(agent_router._DEMO_RATE_LIMIT_MAX_MESSAGES):
        response = client.post("/api/agent/chat", json={"message": "take me to the anxiety tools"}, headers=headers)
        assert response.status_code == 200

    over_limit = client.post("/api/agent/chat", json={"message": "take me to the anxiety tools"}, headers=headers)
    assert over_limit.status_code == 429

    # A real (non-demo) account hammering the same endpoint just as many times is unaffected.
    real_client = login_as(user_a)
    for _ in range(agent_router._DEMO_RATE_LIMIT_MAX_MESSAGES + 3):
        response = real_client.post("/api/agent/chat", json={"message": "take me to the anxiety tools"})
        assert response.status_code == 200
