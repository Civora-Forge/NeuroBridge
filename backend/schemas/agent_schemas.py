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
    user_id: int
    created_at: datetime
    updated_at: datetime
    messages: List[AgentMessageResponse] = []

    class Config:
        orm_mode = True
        from_attributes = True

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None
