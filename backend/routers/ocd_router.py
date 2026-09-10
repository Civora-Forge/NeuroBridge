import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..auth import get_current_user, CurrentUser
from ..models import ocd_models
from ..schemas import ocd_schemas
from ..services import ai_service
from ..services.rate_limiter import SlidingWindowRateLimiter

router = APIRouter()

# These three endpoints each trigger a real Gemini call (ai_service.*) outside the
# agent chat loop, so without their own limit a user could bypass the agent's
# per-hour rate limit entirely by spamming journal entries / ERP sessions / hierarchies.
_AI_WRITE_RATE_LIMIT_PER_HOUR = int(os.getenv("OCD_AI_RATE_LIMIT_PER_HOUR", "40"))
_ai_write_limiter = SlidingWindowRateLimiter(
    _AI_WRITE_RATE_LIMIT_PER_HOUR,
    3600,
    "You've created a lot of AI-assisted entries in a short time — please wait a bit before adding more.",
)

# --- Exposure Hierarchies ---

@router.post("/hierarchies/", response_model=ocd_schemas.ExposureHierarchy)
def create_hierarchy(
    hierarchy: ocd_schemas.ExposureHierarchyCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    _ai_write_limiter.check(user.id)

    db_hierarchy = ocd_models.ExposureHierarchy(**hierarchy.model_dump(), owner_id=user.id)
    db.add(db_hierarchy)
    db.commit()
    db.refresh(db_hierarchy)

    suggestions = ai_service.generate_exposure_suggestions(hierarchy.category)
    for i, desc in enumerate(suggestions):
        task = ocd_models.ExposureTask(
            description=desc,
            estimated_suds=(i + 1) * 20,
            order_index=i,
            hierarchy_id=db_hierarchy.id
        )
        db.add(task)
    db.commit()
    db.refresh(db_hierarchy)
    return db_hierarchy

@router.get("/hierarchies/", response_model=List[ocd_schemas.ExposureHierarchy])
def read_hierarchies(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return (
        db.query(ocd_models.ExposureHierarchy)
        .filter(ocd_models.ExposureHierarchy.owner_id == user.id)
        .offset(skip)
        .limit(limit)
        .all()
    )

def _get_owned_hierarchy(db: Session, hierarchy_id: int, user: CurrentUser) -> ocd_models.ExposureHierarchy:
    hierarchy = (
        db.query(ocd_models.ExposureHierarchy)
        .filter(ocd_models.ExposureHierarchy.id == hierarchy_id, ocd_models.ExposureHierarchy.owner_id == user.id)
        .first()
    )
    if not hierarchy:
        raise HTTPException(status_code=404, detail="Hierarchy not found")
    return hierarchy

def _get_owned_task(db: Session, task_id: int, user: CurrentUser) -> ocd_models.ExposureTask:
    task = (
        db.query(ocd_models.ExposureTask)
        .join(ocd_models.ExposureHierarchy)
        .filter(
            ocd_models.ExposureTask.id == task_id,
            ocd_models.ExposureHierarchy.owner_id == user.id,
        )
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Exposure step not found")
    return task

# --- Exposure Tasks (steps within a hierarchy) ---

@router.post("/hierarchies/{hierarchy_id}/tasks/", response_model=ocd_schemas.ExposureTask)
def create_task(
    hierarchy_id: int,
    task: ocd_schemas.ExposureTaskCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    hierarchy = _get_owned_hierarchy(db, hierarchy_id, user)
    max_order = max([t.order_index for t in hierarchy.tasks], default=-1)
    db_task = ocd_models.ExposureTask(
        description=task.description,
        estimated_suds=task.estimated_suds,
        order_index=max_order + 1,
        hierarchy_id=hierarchy.id,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@router.patch("/tasks/{task_id}", response_model=ocd_schemas.ExposureTask)
def update_task(
    task_id: int,
    update: ocd_schemas.ExposureTaskUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    task = _get_owned_task(db, task_id, user)
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task

@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    task = _get_owned_task(db, task_id, user)
    db.delete(task)
    db.commit()
    return None

# --- ERP Sessions ---

@router.post("/sessions/", response_model=ocd_schemas.ERPSession)
def create_session(
    session: ocd_schemas.ERPSessionCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    _ai_write_limiter.check(user.id)

    db_session = ocd_models.ERPSession(**session.model_dump(), owner_id=user.id, status="completed")

    summary = ai_service.summarize_erp_session(
        session.pre_suds, session.post_suds, session.duration_seconds, session.resisted_compulsion, session.notes or ""
    )
    db_session.ai_summary = summary

    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@router.patch("/sessions/{session_id}/complete", response_model=ocd_schemas.ERPSession)
def complete_session(
    session_id: int,
    completion: ocd_schemas.ERPSessionComplete,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Completes a session that already exists (e.g. one the agent started
    via start_erp_session) instead of creating a second, duplicate row the
    way POST /sessions/ would — this is the manual-UI equivalent of the
    agent's own complete_erp_session tool, reusing the exact same logic."""
    from datetime import datetime as _dt

    session = db.query(ocd_models.ERPSession).filter_by(id=session_id, owner_id=user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.post_suds = completion.post_suds
    session.resisted_compulsion = completion.resisted_compulsion
    session.notes = completion.notes
    session.status = "completed"
    session.completed_at = _dt.utcnow()
    session.duration_seconds = int((session.completed_at - session.created_at).total_seconds())
    session.ai_summary = ai_service.summarize_erp_session(
        session.pre_suds, session.post_suds, session.duration_seconds, session.resisted_compulsion, session.notes or ""
    )
    db.commit()
    db.refresh(session)
    return session

@router.get("/sessions/", response_model=List[ocd_schemas.ERPSession])
def read_sessions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return (
        db.query(ocd_models.ERPSession)
        .filter(ocd_models.ERPSession.owner_id == user.id)
        .offset(skip)
        .limit(limit)
        .all()
    )

# --- SUDS Logs ---

@router.post("/suds/", response_model=ocd_schemas.SUDSLog)
def create_suds_log(
    suds: ocd_schemas.SUDSLogCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    db_suds = ocd_models.SUDSLog(**suds.model_dump(), owner_id=user.id)
    db.add(db_suds)
    db.commit()
    db.refresh(db_suds)
    return db_suds

@router.get("/suds/", response_model=List[ocd_schemas.SUDSLog])
def read_suds_logs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return (
        db.query(ocd_models.SUDSLog)
        .filter(ocd_models.SUDSLog.owner_id == user.id)
        .order_by(ocd_models.SUDSLog.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

# --- Journal Entries ---

@router.post("/journal/", response_model=ocd_schemas.OCDJournalEntry)
def create_journal_entry(
    entry: ocd_schemas.OCDJournalEntryCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    _ai_write_limiter.check(user.id)

    db_entry = ocd_models.OCDJournalEntry(**entry.model_dump(), owner_id=user.id)

    analysis = ai_service.analyze_journal_entry(
        entry.trigger, entry.obsession, entry.emotion or "", entry.anxiety_level
    )
    db_entry.ai_analysis = analysis

    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

@router.get("/journal/", response_model=List[ocd_schemas.OCDJournalEntry])
def read_journal_entries(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return (
        db.query(ocd_models.OCDJournalEntry)
        .filter(ocd_models.OCDJournalEntry.owner_id == user.id)
        .order_by(ocd_models.OCDJournalEntry.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
