from backend.services import safety
from backend.services.agent_service import AgentOrchestrator
from backend.database import SessionLocal


def test_crisis_language_is_escalated_and_blocked():
    assessment = safety.assess_message_safety("I don't want to be here anymore, I want to kill myself")
    assert assessment.level == safety.SafetyLevel.ESCALATE
    assert assessment.allowed is False
    assert "crisis_language_detected" in assessment.reason_codes


def test_diagnosis_seeking_language_is_cautioned_but_allowed():
    assessment = safety.assess_message_safety("Can you diagnose me with OCD?")
    assert assessment.level == safety.SafetyLevel.CAUTION
    assert assessment.allowed is True


def test_ordinary_message_is_standard():
    assessment = safety.assess_message_safety("I have an assignment due tomorrow and haven't started")
    assert assessment.level == safety.SafetyLevel.STANDARD
    assert assessment.allowed is True


def test_orchestrator_short_circuits_crisis_message_without_calling_gemini(user_a, monkeypatch):
    """No GEMINI_API_KEY is required for this path — the safety filter must run before any LLM call."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("I want to end my life")
        assert result["action"] is None
        assert "AASRA" in result["response"] or "crisis" in result["response"].lower()
    finally:
        db.close()


def test_orchestrator_handles_navigation_shortcut_without_gemini(user_a, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("take me to the anxiety tools")
        assert result["action"] == {"type": "NAVIGATE", "path": "/anxiety"}
    finally:
        db.close()


def test_crisis_message_proves_gemini_is_never_constructed_or_called(user_a, install_fake_gemini):
    """Stronger than checking the reply text: even with a (fake) Gemini fully wired up and
    ready to answer, a crisis message must never reach it — not even to construct the model."""
    call_log, construction_count = install_fake_gemini([])  # no responses queued — using it at all would crash

    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("I want to kill myself")
    finally:
        db.close()

    assert construction_count["n"] == 0
    assert call_log == []
    assert result["action"] is None


def test_crisis_message_does_not_execute_any_tool(user_a, install_fake_gemini):
    from backend.models import agent_models

    install_fake_gemini([])
    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db, user_a)
        orchestrator.process_message("I want to end my life")
        logs = db.query(agent_models.AgentActionLog).filter_by(user_id=user_a.id).all()
    finally:
        db.close()

    assert len(logs) == 1
    assert logs[0].status == "escalated"
    assert logs[0].tool_name is None


def test_ordinary_support_language_does_reach_gemini(user_a, install_fake_gemini):
    """Contrast case for the crisis test above: normal mental-health language (not crisis,
    not a navigation shortcut) must proceed to the LLM rather than being over-blocked."""
    from backend.tests.conftest import FakePart, FakeResponse

    final = FakeResponse(parts=[FakePart()], text="That sounds tough — want to try a grounding exercise?")
    call_log, construction_count = install_fake_gemini([final])

    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db, user_a)
        result = orchestrator.process_message("I'm feeling really anxious and overwhelmed right now")
    finally:
        db.close()

    assert construction_count["n"] == 1
    assert len(call_log) == 1
    assert "grounding" in result["response"].lower()
