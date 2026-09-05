from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..auth import get_current_user, CurrentUser
from ..models import anxiety_models
from ..schemas import anxiety_schemas

router = APIRouter()


@router.get("/grounding-sessions", response_model=List[anxiety_schemas.GroundingSession])
def read_grounding_sessions(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return (
        db.query(anxiety_models.GroundingSession)
        .filter(anxiety_models.GroundingSession.user_id == user.id)
        .order_by(anxiety_models.GroundingSession.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
