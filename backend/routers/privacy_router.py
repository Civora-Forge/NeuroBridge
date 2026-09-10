"""
Data export / data deletion for the authenticated user.

Data-minimization principle: every route here is scoped to `user.id` only
(never a cross-user query) — the same ownership pattern already enforced and
tested throughout the rest of the backend (see test_*_isolation.py). This
router exists so that principle is also exposed to the *user themselves* as a
real, working "see everything about me" / "delete everything about me"
control, not just an internal guarantee.

Deletion order matters: children are deleted before parents because none of
the FKs here are ON DELETE CASCADE (see the migrations) — deleting a parent
first would raise an IntegrityError.

This deletes the user's NeuroBridge application data. It does not delete the
underlying Supabase auth account (email/password) — that requires the
Supabase Admin API and a service-role key, which this backend deliberately
does not hold (see auth.py's design note on never needing a service role).
If SUPABASE_SERVICE_ROLE_KEY is configured, the auth account is deleted too;
otherwise the response says so explicitly rather than silently no-op'ing.
"""

import os
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import adhd_models, agent_models, anxiety_models, asd_models, ocd_models

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def _row_to_dict(row) -> dict:
    out = {}
    for column in row.__table__.columns:
        value = getattr(row, column.name)
        out[column.name] = value.isoformat() if isinstance(value, datetime) else value
    return out


@router.get("/export")
def export_my_data(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)) -> dict:
    """Everything NeuroBridge's FastAPI backend has stored about the caller,
    as one JSON document. Does not include data that lives only in Supabase
    tables accessed directly from the frontend (reading_files, reading_sessions,
    word_metrics, phoneme_errors, cognitive_profiles, support_* tables) — those
    are exported directly from Supabase by the frontend's own authenticated
    client using the user's own RLS-scoped session (see PrivacyDataPanel.jsx),
    since this backend has no service-role access to them.
    """
    hierarchy_ids = [
        h.id for h in db.query(ocd_models.ExposureHierarchy.id).filter_by(owner_id=user.id).all()
    ]
    tasks = (
        db.query(ocd_models.ExposureTask).filter(ocd_models.ExposureTask.hierarchy_id.in_(hierarchy_ids)).all()
        if hierarchy_ids
        else []
    )
    breakdown_ids = [
        b.id for b in db.query(adhd_models.TaskBreakdown.id).filter_by(user_id=user.id).all()
    ]
    steps = (
        db.query(adhd_models.TaskStep).filter(adhd_models.TaskStep.breakdown_id.in_(breakdown_ids)).all()
        if breakdown_ids
        else []
    )
    conversation_ids = [
        c.id for c in db.query(agent_models.AgentConversation.id).filter_by(user_id=user.id).all()
    ]
    messages = (
        db.query(agent_models.AgentMessage).filter(agent_models.AgentMessage.conversation_id.in_(conversation_ids)).all()
        if conversation_ids
        else []
    )

    return {
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "user_id": user.id,
        "email": user.email,
        "ocd": {
            "exposure_hierarchies": [_row_to_dict(r) for r in db.query(ocd_models.ExposureHierarchy).filter_by(owner_id=user.id).all()],
            "exposure_tasks": [_row_to_dict(r) for r in tasks],
            "erp_sessions": [_row_to_dict(r) for r in db.query(ocd_models.ERPSession).filter_by(owner_id=user.id).all()],
            "suds_logs": [_row_to_dict(r) for r in db.query(ocd_models.SUDSLog).filter_by(owner_id=user.id).all()],
            "journal_entries": [_row_to_dict(r) for r in db.query(ocd_models.OCDJournalEntry).filter_by(owner_id=user.id).all()],
        },
        "adhd": {
            "task_breakdowns": [_row_to_dict(r) for r in db.query(adhd_models.TaskBreakdown).filter_by(user_id=user.id).all()],
            "task_steps": [_row_to_dict(r) for r in steps],
            "focus_sessions": [_row_to_dict(r) for r in db.query(adhd_models.FocusSession).filter_by(user_id=user.id).all()],
        },
        "anxiety": {
            "grounding_sessions": [_row_to_dict(r) for r in db.query(anxiety_models.GroundingSession).filter_by(user_id=user.id).all()],
        },
        "asd": {
            "social_scenarios": [_row_to_dict(r) for r in db.query(asd_models.SocialScenario).filter_by(user_id=user.id).all()],
            "routine_steps": [_row_to_dict(r) for r in db.query(asd_models.RoutineStep).filter_by(user_id=user.id).all()],
        },
        "agent": {
            "conversations": [_row_to_dict(r) for r in db.query(agent_models.AgentConversation).filter_by(user_id=user.id).all()],
            "messages": [_row_to_dict(r) for r in messages],
            "learnings": [_row_to_dict(r) for r in db.query(agent_models.AgentLearning).filter_by(user_id=user.id).all()],
            "action_logs": [_row_to_dict(r) for r in db.query(agent_models.AgentActionLog).filter_by(user_id=user.id).all()],
            "intervention_outcomes": [_row_to_dict(r) for r in db.query(agent_models.InterventionOutcome).filter_by(user_id=user.id).all()],
        },
    }


def _delete_all_backend_data(db: Session, user_id: str) -> dict:
    hierarchy_ids = [h.id for h in db.query(ocd_models.ExposureHierarchy.id).filter_by(owner_id=user_id).all()]
    breakdown_ids = [b.id for b in db.query(adhd_models.TaskBreakdown.id).filter_by(user_id=user_id).all()]
    conversation_ids = [c.id for c in db.query(agent_models.AgentConversation.id).filter_by(user_id=user_id).all()]

    deleted = {}

    if hierarchy_ids:
        deleted["exposure_tasks"] = (
            db.query(ocd_models.ExposureTask)
            .filter(ocd_models.ExposureTask.hierarchy_id.in_(hierarchy_ids))
            .delete(synchronize_session=False)
        )
    deleted["suds_logs"] = db.query(ocd_models.SUDSLog).filter_by(owner_id=user_id).delete(synchronize_session=False)
    deleted["erp_sessions"] = db.query(ocd_models.ERPSession).filter_by(owner_id=user_id).delete(synchronize_session=False)
    deleted["exposure_hierarchies"] = (
        db.query(ocd_models.ExposureHierarchy).filter_by(owner_id=user_id).delete(synchronize_session=False)
    )
    deleted["journal_entries"] = (
        db.query(ocd_models.OCDJournalEntry).filter_by(owner_id=user_id).delete(synchronize_session=False)
    )

    if breakdown_ids:
        deleted["task_steps"] = (
            db.query(adhd_models.TaskStep)
            .filter(adhd_models.TaskStep.breakdown_id.in_(breakdown_ids))
            .delete(synchronize_session=False)
        )
    deleted["task_breakdowns"] = (
        db.query(adhd_models.TaskBreakdown).filter_by(user_id=user_id).delete(synchronize_session=False)
    )
    deleted["focus_sessions"] = (
        db.query(adhd_models.FocusSession).filter_by(user_id=user_id).delete(synchronize_session=False)
    )

    deleted["grounding_sessions"] = (
        db.query(anxiety_models.GroundingSession).filter_by(user_id=user_id).delete(synchronize_session=False)
    )

    deleted["social_scenarios"] = (
        db.query(asd_models.SocialScenario).filter_by(user_id=user_id).delete(synchronize_session=False)
    )
    deleted["routine_steps"] = (
        db.query(asd_models.RoutineStep).filter_by(user_id=user_id).delete(synchronize_session=False)
    )

    if conversation_ids:
        deleted["agent_messages"] = (
            db.query(agent_models.AgentMessage)
            .filter(agent_models.AgentMessage.conversation_id.in_(conversation_ids))
            .delete(synchronize_session=False)
        )
    deleted["agent_conversations"] = (
        db.query(agent_models.AgentConversation).filter_by(user_id=user_id).delete(synchronize_session=False)
    )
    deleted["agent_learnings"] = (
        db.query(agent_models.AgentLearning).filter_by(user_id=user_id).delete(synchronize_session=False)
    )
    deleted["agent_action_logs"] = (
        db.query(agent_models.AgentActionLog).filter_by(user_id=user_id).delete(synchronize_session=False)
    )
    deleted["intervention_outcomes"] = (
        db.query(agent_models.InterventionOutcome).filter_by(user_id=user_id).delete(synchronize_session=False)
    )

    db.commit()
    return deleted


@router.delete("/data")
def delete_my_data(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)) -> dict:
    """Permanently deletes every row this backend holds for the caller, across
    every domain table (OCD/ADHD/anxiety/ASD/agent). Irreversible. Scoped
    strictly to `user.id` — never touches another user's rows.

    Does not delete Supabase-native tables the frontend writes directly
    (reading_files, reading_sessions, etc.) or the Supabase auth account
    itself unless a service-role key is configured (see module docstring).
    """
    deleted_counts = _delete_all_backend_data(db, user.id)

    auth_account_deleted = False
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and not user.is_demo:
        try:
            resp = httpx.delete(
                f"{SUPABASE_URL}/auth/v1/admin/users/{user.id}",
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                },
                timeout=10.0,
            )
            auth_account_deleted = resp.status_code in (200, 204)
        except httpx.HTTPError:
            auth_account_deleted = False

    return {
        "status": "deleted",
        "deleted_counts": deleted_counts,
        "auth_account_deleted": auth_account_deleted,
        "note": (
            "Your NeuroBridge sign-in account was also removed."
            if auth_account_deleted
            else "Your application data was deleted. Your sign-in account itself was not removed automatically — "
            "contact support to close it, or it can be deleted from the Supabase dashboard."
        ),
    }
