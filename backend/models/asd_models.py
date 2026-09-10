from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from datetime import datetime
from ..database import Base


class SocialScenario(Base):
    __tablename__ = "asd_social_scenarios"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    context = Column(String)
    generated_story = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class RoutineStep(Base):
    """A real, backend-persisted step in a user's daily routine/visual
    schedule — the smallest genuinely useful version of "what happens next"
    support: predictability and step-by-step structure are the actual,
    research-grounded ASD need (NICE CG142/CG170), not a stereotype. Exactly
    one step per user should have is_current=True at a time; that's the
    single source of truth both the agent and any future UI read from."""

    __tablename__ = "asd_routine_steps"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    is_current = Column(Boolean, default=False)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
