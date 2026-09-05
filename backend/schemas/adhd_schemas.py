from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class TaskStep(BaseModel):
    id: int
    description: str
    estimated_minutes: int
    is_completed: bool
    class Config:
        from_attributes = True


class TaskBreakdown(BaseModel):
    id: int
    original_task: str
    created_at: datetime
    steps: List[TaskStep] = []
    class Config:
        from_attributes = True


class FocusSession(BaseModel):
    id: int
    duration_minutes: int
    intent: Optional[str] = None
    status: str
    created_at: datetime
    class Config:
        from_attributes = True
