from unittest.mock import patch

import httpx


def test_missing_authorization_header_is_401(client):
    response = client.get("/api/agent/conversations")
    assert response.status_code == 401


def test_malformed_authorization_header_is_401(client):
    response = client.get("/api/agent/conversations", headers={"Authorization": "NotBearer xyz"})
    assert response.status_code == 401


def test_invalid_token_rejected_by_supabase_is_401(client):
    class FakeResponse:
        status_code = 401
        def json(self):
            return {}

    with patch("backend.auth.httpx.get", return_value=FakeResponse()):
        response = client.get("/api/agent/conversations", headers={"Authorization": "Bearer bad-token"})
    assert response.status_code == 401


def test_valid_token_resolves_to_current_user(client):
    class FakeResponse:
        status_code = 200
        def json(self):
            return {"id": "real-user-uuid", "email": "real@example.com"}

    with patch("backend.auth.httpx.get", return_value=FakeResponse()):
        response = client.get("/api/agent/conversations", headers={"Authorization": "Bearer good-token"})
    assert response.status_code == 200
    assert response.json() == []


def test_supabase_unreachable_is_503(client):
    with patch("backend.auth.httpx.get", side_effect=httpx.ConnectError("boom")):
        response = client.get("/api/agent/conversations", headers={"Authorization": "Bearer some-token"})
    assert response.status_code == 503
