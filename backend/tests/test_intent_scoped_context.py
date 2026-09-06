"""
P1.6 — intent-scoped context: only fetch the module summaries actually
relevant to the message, never all three unconditionally. The safe-by-default
direction (ambiguous -> broaden) is tested too, since under-fetching is the
real risk to avoid.
"""

from backend.services.context_scope import infer_relevant_modules, ALL_MODULES


def test_adhd_specific_message_scopes_to_adhd_only():
    assert infer_relevant_modules("I can't start my assignment, it's due tomorrow") == frozenset({"adhd"})


def test_ocd_specific_message_scopes_to_ocd_only():
    assert infer_relevant_modules("I want to log an ERP exposure session") == frozenset({"ocd"})


def test_anxiety_specific_message_scopes_to_anxiety_only():
    assert infer_relevant_modules("I'm feeling really anxious and need grounding") == frozenset({"anxiety"})


def test_ambiguous_message_broadens_to_everything():
    """Under-fetching is the real risk — ambiguous/general requests must never
    narrow away context the agent might genuinely need."""
    assert infer_relevant_modules("hey, how's it going?") == ALL_MODULES
    assert infer_relevant_modules("") == ALL_MODULES


def test_context_builder_only_queries_relevant_modules(user_a, monkeypatch):
    """Integration-level proof: an ADHD-only message must not trigger the
    OCD/anxiety DB query functions at all."""
    from backend.database import SessionLocal
    from backend.services import agent_service

    call_counts = {"ocd": 0, "anxiety": 0, "adhd": 0}
    real_ocd = agent_service.agent_tools._get_ocd_progress
    real_anxiety = agent_service.agent_tools._get_anxiety_history
    real_adhd = agent_service.agent_tools._get_recent_tasks

    def counting_ocd(ctx):
        call_counts["ocd"] += 1
        return real_ocd({}, ctx)

    def counting_anxiety(ctx):
        call_counts["anxiety"] += 1
        return real_anxiety({}, ctx)

    def counting_adhd(ctx):
        call_counts["adhd"] += 1
        return real_adhd({}, ctx)

    monkeypatch.setattr(agent_service, "_MODULE_CONTEXT_BUILDERS", {
        "ocd": counting_ocd, "adhd": counting_adhd, "anxiety": counting_anxiety,
    })

    db = SessionLocal()
    try:
        orchestrator = agent_service.AgentOrchestrator(db, user_a)
        orchestrator._build_context_bundle(None, frozenset({"adhd"}))
    finally:
        db.close()

    assert call_counts == {"ocd": 0, "anxiety": 0, "adhd": 1}
