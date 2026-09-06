"""
P4.18 — real accounts now get a rate limit too (previously only demo mode did),
since the Gemini-cost exposure is identical either way. Generous and
configurable, and must not make normal use of the app unworkable.
"""

from backend.routers import agent_router


def test_real_account_rate_limit_is_enforced_but_generous(login_as, user_a, monkeypatch):
    monkeypatch.setattr(agent_router, "_REAL_RATE_LIMIT_MAX_MESSAGES", 3)
    agent_router._real_chat_timestamps.clear()
    client = login_as(user_a)

    for _ in range(3):
        response = client.post("/api/agent/chat", json={"message": "take me to the anxiety tools"})
        assert response.status_code == 200

    over_limit = client.post("/api/agent/chat", json={"message": "take me to the anxiety tools"})
    assert over_limit.status_code == 429
    assert "wait" in over_limit.json()["detail"].lower()


def test_real_and_demo_rate_limits_are_tracked_independently(login_as, user_a, monkeypatch):
    from backend.main import app
    from backend.auth import get_current_user

    monkeypatch.setattr(agent_router, "_REAL_RATE_LIMIT_MAX_MESSAGES", 1)
    agent_router._real_chat_timestamps.clear()
    agent_router._demo_chat_timestamps.clear()

    client = login_as(user_a)
    client.post("/api/agent/chat", json={"message": "take me to the anxiety tools"})
    limited = client.post("/api/agent/chat", json={"message": "take me to the anxiety tools"})
    assert limited.status_code == 429

    # Drop the real-user dependency override so this next request resolves through
    # the real get_current_user demo-token path instead of the overridden fixture user.
    app.dependency_overrides.pop(get_current_user, None)
    demo_headers = {"Authorization": "Bearer demo:nb-user-042:some-other-browser-session"}
    demo_response = client.post("/api/agent/chat", json={"message": "take me to the anxiety tools"}, headers=demo_headers)
    assert demo_response.status_code == 200  # unaffected by the real account's limit
