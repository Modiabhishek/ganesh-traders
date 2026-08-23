from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime as dt
class datetime(dt):
    @classmethod
    def utcnow(cls):
        return dt.now()
from ..database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="Staff", nullable=False)  # "Admin", "Staff"
    status = Column(String, default="Active", nullable=False) # "Active", "Inactive"
    created_at = Column(DateTime, default=datetime.utcnow)
