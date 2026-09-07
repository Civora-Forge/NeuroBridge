from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base


class AgentConversation(Base):
    __tablename__ = "agent_conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    title = Column(String, default="New Conversation")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("AgentMessage", back_populates="conversation", cascade="all, delete-orphan")


class AgentMessage(Base):
    __tablename__ = "agent_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("agent_conversations.id"))
    role = Column(String)  # 'user', 'model', 'system'
    content = Column(Text)
    action_payload = Column(JSON, nullable=True)  # e.g. {"type": "NAVIGATE", "path": "/adhd/breakdown"}
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("AgentConversation", back_populates="messages")


class AgentLearning(Base):
    """Flat key/value long-term preference + learned-signal store for the agent.

    Doubles as the "user_preferences" store called for in the spec — a
    separate preferences table would just duplicate this same shape.
    """

    __tablename__ = "agent_learnings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    category = Column(String)  # e.g. 'focus_preference', 'task_breakdown_success'
    key = Column(String)
    value = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class AgentActionLog(Base):
    """Structured observability record for every tool call the agent attempts.

    Also doubles as the idempotency ledger for write_confirm tools: `args_hash`
    lets execute_confirmed_tool recognize "this exact confirmed action already
    ran for this conversation" and return the prior result instead of
    re-executing on a duplicate submit/retry.
    """

    __tablename__ = "agent_action_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    conversation_id = Column(Integer, ForeignKey("agent_conversations.id"), nullable=True)
    execution_id = Column(String, index=True, nullable=True)
    tool_name = Column(String, nullable=True)  # null for a plain conversational turn with no tool call
    tool_args = Column(JSON, nullable=True)
    args_hash = Column(String, nullable=True, index=True)
    risk_level = Column(String, nullable=True)  # 'read' | 'write_low' | 'write_confirm'
    status = Column(String, nullable=False)  # 'executed' | 'pending_confirmation' | 'denied' | 'error' | 'escalated'
    error_message = Column(Text, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AgentExecution(Base):
    """The authoritative, backend-owned state machine for one user turn.

    One row per call to AgentOrchestrator.process_message. The frontend
    renders THIS record's `state` (via the streaming endpoint) — it must
    never infer execution state from generated prose.
    """

    __tablename__ = "agent_executions"
    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(String, unique=True, index=True, nullable=False)
    conversation_id = Column(Integer, ForeignKey("agent_conversations.id"), nullable=True)
    user_id = Column(String, index=True, nullable=False)
    state = Column(String, nullable=False, default="IDLE")
    current_step = Column(Integer, default=0)
    tool_name = Column(String, nullable=True)
    error = Column(Text, nullable=True)
    llm_call_count = Column(Integer, default=0)
    tool_call_count = Column(Integer, default=0)
    retry_count = Column(Integer, default=0)
    context_retrieval_ms = Column(Integer, nullable=True)
    llm_latency_ms = Column(Integer, nullable=True)
    tool_latency_ms = Column(Integer, nullable=True)
    total_latency_ms = Column(Integer, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class InterventionOutcome(Base):
    """Closes the personalization loop: what happened after the agent acted."""

    __tablename__ = "intervention_outcomes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    module = Column(String, nullable=False)  # 'ocd' | 'adhd' | 'anxiety' | 'asd' | 'dyslexia'
    tool_name = Column(String, nullable=True)
    outcome_type = Column(String, nullable=False)  # 'started' | 'completed' | 'dismissed' | 'rated'
    rating = Column(Integer, nullable=True)
    meta = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
