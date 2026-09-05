from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class GroundingSession(BaseModel):
    id: int
    exercise_type: str
    pre_anxiety: Optional[int] = None
    post_anxiety: Optional[int] = None
    created_at: datetime
    class Config:
        from_attributes = True
