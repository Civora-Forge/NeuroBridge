from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ExposureTaskBase(BaseModel):
    description: str
    estimated_suds: int
    is_completed: bool = False
    order_index: int = 0

class ExposureTaskCreate(ExposureTaskBase):
    pass

class ExposureTask(ExposureTaskBase):
    id: int
    hierarchy_id: int
    class Config:
        from_attributes = True

class ExposureHierarchyBase(BaseModel):
    title: str
    category: str

class ExposureHierarchyCreate(ExposureHierarchyBase):
    pass

class ExposureHierarchy(ExposureHierarchyBase):
    id: int
    owner_id: str
    created_at: datetime
    tasks: List[ExposureTask] = []
    class Config:
        from_attributes = True

class ERPSessionBase(BaseModel):
    title: str
    pre_suds: int
    post_suds: int
    duration_seconds: int
    resisted_compulsion: bool
    notes: Optional[str] = None

class ERPSessionCreate(ERPSessionBase):
    pass

class ERPSession(ERPSessionBase):
    id: int
    owner_id: str
    status: str
    ai_summary: Optional[str] = None
    exposure_task_id: Optional[int] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class SUDSLogBase(BaseModel):
    value: int
    context_tag: Optional[str] = None

class SUDSLogCreate(SUDSLogBase):
    pass

class SUDSLog(SUDSLogBase):
    id: int
    owner_id: str
    session_id: Optional[int] = None
    created_at: datetime
    class Config:
        from_attributes = True

class OCDJournalEntryBase(BaseModel):
    trigger: str
    obsession: str
    compulsion: Optional[str] = None
    emotion: Optional[str] = None
    anxiety_level: int
    location: Optional[str] = None
    notes: Optional[str] = None

class OCDJournalEntryCreate(OCDJournalEntryBase):
    pass

class OCDJournalEntry(OCDJournalEntryBase):
    id: int
    owner_id: str
    ai_analysis: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True
