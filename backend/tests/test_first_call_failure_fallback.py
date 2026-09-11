"""
Discovered via a live user report: mid-anxiety-conversation, the assistant had
just asked "how are you feeling on a scale of one to ten... try a different
technique whenever you're ready" — the user replied "let's try a different
technique", and the very FIRST Gemini call of that turn (planning, before any
tool has even been chosen) failed (quota/429/timeout). Since no tool had run
yet, there was no real result to fall back on the way the post-tool-call
fallback in test_followup_call_failure_fallback.py has — the user just got a
bare "I'm having a little trouble thinking right now."

The fix, and a second round after a follow-up user report ("it should always
reply something"): every branch of this fallback now ends in a real, concrete
next step for the user — either a real tool genuinely executed (anxiety ->
grounding session, adhd -> focus session, both zero-argument-safe and
no-confirmation), a real place to send them (ocd -> its own page, since
there's no safe zero-argument write there), or, failing a confident topic
match, a real menu of what Bri can still do plus a link to the dashboard.
Never just a bare apology, and never a fabricated success.
"""

from backend.database import SessionLocal
from backend.services import agent_service


class _FailFirstCallChat:
    def send_message(self, *args, **kwargs):
        raise RuntimeError("simulated first-call failure (e.g. quota exhausted)")


class _FailFirstCallModel:
    def start_chat(self, history=None):
        return _FailFirstCallChat()


def _run(user, message, history=None):
    import google.generativeai as genai
    import pytest

    mp = pytest.MonkeyPatch()
    mp.setattr(agent_service, "api_key", "fake-key")
    mp.setattr(genai, "GenerativeModel", lambda **kwargs: _FailFirstCallModel())
    try:
        db = SessionLocal()
        try:
            orchestrator = agent_service.AgentOrchestrator(db, user)
            return orchestrator.process_message(message, history=history)
        finally:
            db.close()
    finally:
        mp.undo()


def test_first_call_failure_in_an_anxiety_conversation_starts_a_real_grounding_session(user_a):
    history = [
        {"role": "user", "content": "I am feeling anxious"},
        {
            "role": "model",
            "content": (
                "How are you feeling right now on a scale of one to ten? We can adjust the "
                "exercise or try a different technique whenever you're ready."
            ),
        },
    ]

    result = _run(user_a, "let's try a different technique", history=history)

    assert result["state"] == "COMPLETED"
    assert "Box Breathing" in result["response"]
    assert "having trouble" in result["response"]
    assert result["action"]["type"] == "NAVIGATE_WITH_DATA"
    assert result["action"]["path"] == "/anxiety"
    assert result["action"]["card_type"] == "GROUNDING_SESSION"

    from backend.models import anxiety_models
    db = SessionLocal()
    try:
        sessions = db.query(anxiety_models.GroundingSession).filter_by(user_id=user_a.id).all()
        assert len(sessions) == 1
        assert sessions[0].exercise_type == "Box Breathing"
    finally:
        db.close()


def test_first_call_failure_in_an_adhd_conversation_starts_a_real_focus_session(user_a):
    result = _run(user_a, "I can't start my assignment, help me focus")

    assert result["state"] == "COMPLETED"
    assert "focus session" in result["response"]
    assert "having trouble" in result["response"]
    assert result["action"]["type"] == "FOCUS_SESSION_CONTROL"
    assert result["action"]["command"] == "start"
    assert result["action"]["path"] == "/adhd/focus"

    from backend.models import adhd_models
    db = SessionLocal()
    try:
        sessions = db.query(adhd_models.FocusSession).filter_by(user_id=user_a.id).all()
        assert len(sessions) == 1
        assert sessions[0].status == "RUNNING"
    finally:
        db.close()


def test_first_call_failure_in_an_ocd_conversation_points_to_the_ocd_page_not_a_guessed_write(user_a):
    """OCD has no zero-argument write tool that's safe to fire blind (creating
    an exposure needs real content the user hasn't given), so this branch
    tells them exactly where to go instead of guessing what to create. No
    action is attached — a NAVIGATE action on a FAILED message would make the
    frontend auto-navigate and close the chat out from under the user
    unprompted, which is worse than the dead end being fixed here."""
    result = _run(user_a, "I want to work on my exposure hierarchy for contamination OCD")

    assert result["state"] == "FAILED"
    assert result["action"] is None
    assert "/ocd" in result["response"]
    assert "having trouble" in result["response"]

    from backend.models import ocd_models
    db = SessionLocal()
    try:
        assert db.query(ocd_models.ExposureTask).count() == 0
    finally:
        db.close()


def test_first_call_failure_with_no_confident_topic_still_offers_a_real_menu(user_a):
    """Not every LLM failure maps to a specific module — but even then, the
    reply is never just an apology: it names the real things Bri can still
    do. No auto-navigate action here either (see the OCD test above for why)."""
    result = _run(user_a, "what's the capital of France")

    assert result["state"] == "FAILED"
    assert result["action"] is None
    assert "having trouble" in result["response"]
    assert "focus session" in result["response"]
    assert "grounding exercise" in result["response"]

    from backend.models import anxiety_models, adhd_models
    db = SessionLocal()
    try:
        assert db.query(anxiety_models.GroundingSession).filter_by(user_id=user_a.id).count() == 0
        assert db.query(adhd_models.FocusSession).filter_by(user_id=user_a.id).count() == 0
    finally:
        db.close()
