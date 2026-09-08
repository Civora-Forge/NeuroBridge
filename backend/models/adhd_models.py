from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base


class TaskBreakdown(Base):
    __tablename__ = "adhd_task_breakdowns"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    original_task = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    steps = relationship("TaskStep", back_populates="breakdown", cascade="all, delete-orphan")


class TaskStep(Base):
    __tablename__ = "adhd_task_steps"
    id = Column(Integer, primary_key=True, index=True)
    breakdown_id = Column(Integer, ForeignKey("adhd_task_breakdowns.id"))
    description = Column(String)
    estimated_minutes = Column(Integer)
    is_completed = Column(Boolean, default=False)

    breakdown = relationship("TaskBreakdown", back_populates="steps")


class FocusSession(Base):
    """The agent's authoritative record of a session's intended status —
    RUNNING/PAUSED/STOPPED/COMPLETED. The actual visible countdown lives in
    FocusSessions.jsx's local timer state; this row is what lets the agent
    (and get_active_focus_session) know what SHOULD be happening without
    depending on any particular browser tab being open. When the page is
    mounted, agent-issued status changes are relayed to it (see
    focusSessionControlStore.js) so the real, visible timer actually reacts —
    this row is never a second, independently-ticking "fake" timer."""

    __tablename__ = "adhd_focus_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    duration_minutes = Column(Integer)
    intent = Column(String, nullable=True)
    status = Column(String, default="RUNNING")  # RUNNING | PAUSED | STOPPED | COMPLETED
    started_at = Column(DateTime, nullable=True)  # when the CURRENT run began (reset on resume)
    paused_at = Column(DateTime, nullable=True)
    accumulated_seconds = Column(Integer, default=0)  # active seconds banked from prior runs
    created_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
