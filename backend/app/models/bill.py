from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime as dt
from ..utils.timezone import get_ist_naive
class datetime(dt):
    @classmethod
    def utcnow(cls):
        return get_ist_naive()
from ..database import Base

class FinancialYearCounter(Base):
    __tablename__ = "fy_counters"

    financial_year = Column(String, primary_key=True) # e.g. "2026-2027"
    last_number = Column(Integer, default=0, nullable=False)

class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    bill_no = Column(String, unique=True, index=True, nullable=False)
    financial_year = Column(String, index=True, nullable=False)
    date = Column(DateTime, default=datetime.utcnow, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String, nullable=False, default="Walk-in Customer (नकद ग्राहक)")
    customer_gstin = Column(String, nullable=True)
    is_interstate = Column(Boolean, default=False, nullable=False)
    
    # Financial amounts stored in integer paise
    subtotal_paise = Column(Integer, default=0, nullable=False)
    total_discount_paise = Column(Integer, default=0, nullable=False)
    taxable_paise = Column(Integer, default=0, nullable=False)
    cgst_paise = Column(Integer, default=0, nullable=False)
    sgst_paise = Column(Integer, default=0, nullable=False)
    igst_paise = Column(Integer, default=0, nullable=False)
    total_tax_paise = Column(Integer, default=0, nullable=False)
    round_off_paise = Column(Integer, default=0, nullable=False)
    grand_total_paise = Column(Integer, default=0, nullable=False)
    paid_amount_paise = Column(Integer, default=0, nullable=False)
    due_amount_paise = Column(Integer, default=0, nullable=False)
    
    payment_mode = Column(String, default="Cash", nullable=False) # Cash, UPI, Split, Credit
    payment_status = Column(String, default="PAID", nullable=False) # PAID, PARTIALLY PAID, DUE
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="Active", nullable=False) # Active, Cancelled
    cancelled_reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    customer = relationship("Customer")
    created_by = relationship("User")
    items = relationship("BillItem", back_populates="bill", cascade="all, delete-orphan")
    payments = relationship("BillPayment", back_populates="bill", cascade="all, delete-orphan")

    @property
    def grand_total(self):
        return self.grand_total_paise / 100.0

    @property
    def paid_amount(self):
        return self.paid_amount_paise / 100.0

    @property
    def due_amount(self):
        return self.due_amount_paise / 100.0

class BillItem(Base):
    __tablename__ = "bill_items"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    barcode = Column(String, index=True, nullable=True)
    product_name = Column(String, nullable=False)
    hsn_code = Column(String, nullable=True)
    qty = Column(Numeric(12, 3), default=1.000, nullable=False)
    unit = Column(String, default="piece", nullable=False)
    
    # Line pricing stored in paise
    mrp_paise = Column(Integer, default=0, nullable=False)
    sale_price_paise = Column(Integer, default=0, nullable=False)
    gross_paise = Column(Integer, default=0, nullable=False)
    line_discount_paise = Column(Integer, default=0, nullable=False)
    allocated_bill_discount_paise = Column(Integer, default=0, nullable=False)
    taxable_paise = Column(Integer, default=0, nullable=False)
    tax_rate = Column(Numeric(5, 2), default=0.00, nullable=False)
    is_tax_inclusive = Column(Boolean, default=True, nullable=False)
    cgst_rate = Column(Numeric(5, 2), default=0.00, nullable=False)
    cgst_paise = Column(Integer, default=0, nullable=False)
    sgst_rate = Column(Numeric(5, 2), default=0.00, nullable=False)
    sgst_paise = Column(Integer, default=0, nullable=False)
    igst_rate = Column(Numeric(5, 2), default=0.00, nullable=False)
    igst_paise = Column(Integer, default=0, nullable=False)
    tax_paise = Column(Integer, default=0, nullable=False)
    line_total_paise = Column(Integer, default=0, nullable=False)

    bill = relationship("Bill", back_populates="items")
    product = relationship("Product")

class BillPayment(Base):
    __tablename__ = "bill_payments"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    mode = Column(String, nullable=False) # Cash, UPI, Credit, Card
    amount_paise = Column(Integer, nullable=False)
    upi_ref_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    bill = relationship("Bill", back_populates="payments")
