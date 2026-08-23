from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from datetime import datetime
from ..database import Base

class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    reminder_date = Column(DateTime, nullable=False)
    reminder_type = Column(String, nullable=False)             # "CUSTOMER_DUE", "SUPPLIER_PAYMENT", "CUSTOM"
    status = Column(String, default="Pending", nullable=False)   # "Pending", "Sent", "Cancelled"
    message = Column(Text, nullable=False)
    sent_time = Column(DateTime, nullable=True)
    channel = Column(String, default="WhatsApp", nullable=False) # "WhatsApp", "SMS"
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Null for system actions
    action = Column(String, nullable=False)                         # "CREATE", "UPDATE", "DELETE", "CANCEL", "IMPORT"
    table_name = Column(String, nullable=False)
    record_id = Column(Integer, nullable=False)
    old_values = Column(Text, nullable=True)                        # JSON stringified representation
    new_values = Column(Text, nullable=True)                        # JSON stringified representation
    created_at = Column(DateTime, default=datetime.utcnow)
