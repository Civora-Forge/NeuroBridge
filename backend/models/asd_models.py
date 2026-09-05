from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from ..database import Base


class SocialScenario(Base):
    __tablename__ = "asd_social_scenarios"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    context = Column(String)
    generated_story = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
