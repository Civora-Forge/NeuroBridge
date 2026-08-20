from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class TaskStepSchema(BaseModel):
    id: int
    description: str
    estimated_minutes: int
    is_completed: bool

    class Config:
        from_attributes = True

class TaskBreakdownSchema(BaseModel):
    id: int
    original_task: str
    steps: List[TaskStepSchema] = []

    class Config:
        from_attributes = True

class FocusSessionSchema(BaseModel):
    id: int
    duration_minutes: int
    intent: Optional[str]
    status: str

    class Config:
        from_attributes = True

class GroundingSessionSchema(BaseModel):
    id: int
    exercise_type: str

    class Config:
        from_attributes = True
