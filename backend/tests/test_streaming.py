"""
P3 — SSE streaming: the backend must emit real, incremental state transitions
as they actually happen (not the final response sent character-by-character).
"""

import json

from backend.tests.conftest import FakeFunctionCall, FakePart, FakeResponse


def test_stream_emits_real_incremental_events_for_a_tool_call_turn(login_as, user_a, install_fake_gemini):
    tool_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("get_recent_tasks", {}))])
    final = FakeResponse(parts=[FakePart()], text="Here are your tasks.")
    install_fake_gemini([tool_call, final])

    client = login_as(user_a)
    with client.stream("POST", "/api/agent/chat/stream", json={"message": "show me my tasks"}) as response:
        assert response.status_code == 200
        events = []
        for line in response.iter_lines():
            if line and line.startswith("data: "):
                events.append(json.loads(line[len("data: "):]))

    types = [e["type"] for e in events]
    assert "execution_started" in types
    assert "tool_started" in types
    assert "tool_completed" in types
    assert types[-1] == "execution_completed"

    tool_started = next(e for e in events if e["type"] == "tool_started")
    assert tool_started["tool"] == "get_recent_tasks"

    completed = events[-1]
    assert completed["state"] == "COMPLETED"
    assert "tasks" in completed["content"].lower() or completed["content"]


def test_stream_emits_confirmation_required_event(login_as, user_a, install_fake_gemini):
    tool_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("create_exposure", {"description": "x"}))])
    install_fake_gemini([tool_call])

    client = login_as(user_a)
    with client.stream("POST", "/api/agent/chat/stream", json={"message": "add an exposure"}) as response:
        events = []
        for line in response.iter_lines():
            if line and line.startswith("data: "):
                events.append(json.loads(line[len("data: "):]))

    state_events = [e for e in events if e.get("state") == "CONFIRMATION_REQUIRED"]
    assert len(state_events) >= 1
    assert events[-1]["type"] == "confirmation_required"  # not mislabeled as a failure


def test_every_stream_event_carries_conversation_id(login_as, user_a, install_fake_gemini):
    """Without this, a frontend consuming only the stream (no separate JSON
    response) could never learn a newly-created conversation's id and would
    start a fresh conversation on every subsequent message."""
    final = FakeResponse(parts=[FakePart()], text="Hi there.")
    install_fake_gemini([final])

    client = login_as(user_a)
    with client.stream("POST", "/api/agent/chat/stream", json={"message": "hello"}) as response:
        events = [json.loads(line[len("data: "):]) for line in response.iter_lines() if line.startswith("data: ")]

    assert len(events) >= 2
    conversation_ids = {e.get("conversation_id") for e in events}
    assert len(conversation_ids) == 1  # every single event agrees on the same conversation id
    assert list(conversation_ids)[0] is not None
