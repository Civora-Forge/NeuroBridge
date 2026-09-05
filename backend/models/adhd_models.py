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
    __tablename__ = "adhd_focus_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    duration_minutes = Column(Integer)
    intent = Column(String, nullable=True)
    status = Column(String, default="planned")  # planned, completed, abandoned
    created_at = Column(DateTime, default=datetime.utcnow)
