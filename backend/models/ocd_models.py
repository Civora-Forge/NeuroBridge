from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    
    hierarchies = relationship("ExposureHierarchy", back_populates="owner")
    sessions = relationship("ERPSession", back_populates="owner")
    suds_logs = relationship("SUDSLog", back_populates="owner")
    journal_entries = relationship("OCDJournalEntry", back_populates="owner")


class ExposureHierarchy(Base):
    __tablename__ = "exposure_hierarchies"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    category = Column(String)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="hierarchies")
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
    post_suds = Column(Integer)
    duration_seconds = Column(Integer)
    resisted_compulsion = Column(Boolean)
    notes = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="sessions")


class SUDSLog(Base):
    __tablename__ = "suds_logs"

    id = Column(Integer, primary_key=True, index=True)
    value = Column(Integer)
    context_tag = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="suds_logs")


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
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="journal_entries")
