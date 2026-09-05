from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..auth import get_current_user, CurrentUser
from ..models import adhd_models
from ..schemas import adhd_schemas

router = APIRouter()


@router.get("/tasks", response_model=List[adhd_schemas.TaskBreakdown])
def read_task_breakdowns(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return (
        db.query(adhd_models.TaskBreakdown)
        .filter(adhd_models.TaskBreakdown.user_id == user.id)
        .order_by(adhd_models.TaskBreakdown.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/focus-sessions", response_model=List[adhd_schemas.FocusSession])
def read_focus_sessions(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return (
        db.query(adhd_models.FocusSession)
        .filter(adhd_models.FocusSession.user_id == user.id)
        .order_by(adhd_models.FocusSession.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
