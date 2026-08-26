from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text
from datetime import datetime as dt
class datetime(dt):
    @classmethod
    def utcnow(cls):
        return dt.now()
from ..database import Base

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    customer_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, index=True, nullable=False)
    mobile = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    customer_type = Column(String, default="Retail", nullable=False)  # "Retail", "Wholesale"
    payment_type = Column(String, default="Cash", nullable=False)    # "Cash", "Monthly Credit", "Other"
    opening_balance = Column(Numeric(12, 2), default=0.00, nullable=False)
    current_balance = Column(Numeric(12, 2), default=0.00, nullable=False)
    credit_limit = Column(Numeric(12, 2), default=0.00, nullable=False)
    status = Column(String, default="Active", nullable=False)          # "Active", "Inactive"
    fathers_name = Column(String, nullable=True)
    reference = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Customer Portal Credentials
    portal_username = Column(String, unique=True, index=True, nullable=True)
    portal_password_hash = Column(String, nullable=True)
    portal_status = Column(String, default="Blocked", nullable=False) # "Allowed", "Blocked"

class LiveUpdate(Base):
    __tablename__ = "live_updates"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
