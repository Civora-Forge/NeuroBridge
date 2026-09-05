from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class AgentMessageBase(BaseModel):
    role: str
    content: str
    action_payload: Optional[Dict[str, Any]] = None

class AgentMessageCreate(AgentMessageBase):
    pass

class AgentMessageResponse(AgentMessageBase):
    id: int
    conversation_id: int
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class AgentConversationBase(BaseModel):
    title: Optional[str] = "New Conversation"

class AgentConversationCreate(AgentConversationBase):
    pass

class AgentConversationResponse(AgentConversationBase):
    id: int
    user_id: str
    created_at: datetime
    updated_at: datetime
    messages: List[AgentMessageResponse] = []

    class Config:
        orm_mode = True
        from_attributes = True

class ClientContext(BaseModel):
    """Small, explicit snapshot of frontend-only (localStorage-backed) state the
    frontend chooses to share for this turn — e.g. recent ADHD task titles, ASD
    routine streaks. Treated as untrusted supplementary text, never written
    back to the database and never given elevated trust over server data."""
    recent_task_titles: Optional[List[str]] = None
    focus_streak_days: Optional[int] = None
    recent_module_activity: Optional[List[str]] = None

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None
    client_context: Optional[ClientContext] = None

class ToolExecuteRequest(BaseModel):
    """Confirms and executes a previously proposed write_confirm tool call."""
    conversation_id: int
    tool_name: str
    tool_args: Dict[str, Any] = {}

class ToolExecuteResponse(BaseModel):
    status: str  # 'executed' | 'denied' | 'error'
    tool_name: str
    result: Optional[Dict[str, Any]] = None
    message: str
