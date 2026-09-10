"""
The three OCD endpoints that trigger a direct Gemini call outside the agent
chat loop (create hierarchy / ERP session / journal entry) each need their own
rate limit — otherwise a user could bypass AGENT_REAL_RATE_LIMIT_PER_HOUR
entirely by spamming e.g. journal entries, each one a real Gemini call.
"""

from backend.routers import ocd_router


def test_journal_entry_ai_calls_are_rate_limited(login_as, user_a, monkeypatch):
    monkeypatch.setattr(ocd_router._ai_write_limiter, "max_events", 2)
    ocd_router._ai_write_limiter.clear()
    client = login_as(user_a)

    for _ in range(2):
        response = client.post(
            "/api/ocd/journal/",
            json={"trigger": "doorknob", "obsession": "contamination", "emotion": "anxious", "anxiety_level": 60},
        )
        assert response.status_code == 200

    over_limit = client.post(
        "/api/ocd/journal/",
        json={"trigger": "doorknob", "obsession": "contamination", "emotion": "anxious", "anxiety_level": 60},
    )
    assert over_limit.status_code == 429
    assert "wait" in over_limit.json()["detail"].lower()


def test_ai_write_limit_is_shared_across_the_three_ai_triggering_endpoints(login_as, user_a, monkeypatch):
    """Hierarchy creation, ERP sessions, and journal entries all draw from the
    same per-user bucket — the limit exists to cap Gemini cost exposure per
    user, not per endpoint."""
    monkeypatch.setattr(ocd_router._ai_write_limiter, "max_events", 1)
    ocd_router._ai_write_limiter.clear()
    client = login_as(user_a)

    first = client.post("/api/ocd/hierarchies/", json={"title": "Contamination", "category": "contamination"})
    assert first.status_code == 200

    second = client.post(
        "/api/ocd/journal/",
        json={"trigger": "doorknob", "obsession": "contamination", "emotion": "anxious", "anxiety_level": 60},
    )
    assert second.status_code == 429
