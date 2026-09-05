from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base

# NOTE: user identity is Supabase's auth.users (UUID, verified server-side via
# backend/auth.py) — there is no local shadow "users" table. owner_id columns
# below store that UUID as a plain string.


class ExposureHierarchy(Base):
    __tablename__ = "exposure_hierarchies"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    category = Column(String)
    owner_id = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    tasks = relationship("ExposureTask", back_populates="hierarchy", cascade="all, delete-orphan")


class ExposureTask(Base):
    __tablename__ = "exposure_tasks"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String)
    estimated_suds = Column(Integer)
    is_completed = Column(Boolean, default=False)
    order_index = Column(Integer, default=0)
    hierarchy_id = Column(Integer, ForeignKey("exposure_hierarchies.id"))

    hierarchy = relationship("ExposureHierarchy", back_populates="tasks")


class ERPSession(Base):
    __tablename__ = "erp_sessions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    pre_suds = Column(Integer)
    post_suds = Column(Integer, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    resisted_compulsion = Column(Boolean, nullable=True)
    notes = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)
    status = Column(String, default="completed")  # 'in_progress' | 'completed' — agent-started sessions begin in_progress
    exposure_task_id = Column(Integer, ForeignKey("exposure_tasks.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    owner_id = Column(String, index=True, nullable=False)


class SUDSLog(Base):
    __tablename__ = "suds_logs"

    id = Column(Integer, primary_key=True, index=True)
    value = Column(Integer)
    context_tag = Column(String, nullable=True)
    session_id = Column(Integer, ForeignKey("erp_sessions.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(String, index=True, nullable=False)


class OCDJournalEntry(Base):
    __tablename__ = "ocd_journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    trigger = Column(String)
    obsession = Column(String)
    compulsion = Column(String, nullable=True)
    emotion = Column(String, nullable=True)
    anxiety_level = Column(Integer)
    location = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    ai_analysis = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(String, index=True, nullable=False)
