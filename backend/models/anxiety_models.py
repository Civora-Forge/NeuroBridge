from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from datetime import datetime
from ..database import Base

class GroundingSession(Base):
    __tablename__ = "anxiety_grounding_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    exercise_type = Column(String)
    pre_anxiety = Column(Integer, nullable=True)
    post_anxiety = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
