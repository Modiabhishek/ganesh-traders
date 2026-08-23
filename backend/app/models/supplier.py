from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime as dt
class datetime(dt):
    @classmethod
    def utcnow(cls):
        return dt.now()
from ..database import Base

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    supplier_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, index=True, nullable=False)
    mobile = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    payment_terms = Column(Integer, default=7, nullable=False)  # Net days for payment (e.g. 7 days)
    status = Column(String, default="Active", nullable=False)   # "Active", "Inactive"
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
