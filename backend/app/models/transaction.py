from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime as dt
class datetime(dt):
    @classmethod
    def utcnow(cls):
        return dt.now()
from ..database import Base

class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    sale_number = Column(String, unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True) # Null for walk-in
    sale_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    subtotal = Column(Numeric(12, 2), default=0.00, nullable=False)
    discount = Column(Numeric(12, 2), default=0.00, nullable=False)
    total_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    paid_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    due_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    payment_method = Column(String, default="Cash", nullable=False) # "Cash", "UPI", "Card", "Credit"
    payment_status = Column(String, default="PAID", nullable=False) # "PAID", "PARTIALLY PAID", "DUE"
    status = Column(String, default="Active", nullable=False)      # "Active", "Cancelled"
    cancelled_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")

class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(12, 2), default=0.00, nullable=False)
    price = Column(Numeric(12, 2), default=0.00, nullable=False)
    total = Column(Numeric(12, 2), default=0.00, nullable=False)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")

class CustomerPayment(Base):
    __tablename__ = "customer_payments"

    id = Column(Integer, primary_key=True, index=True)
    payment_number = Column(String, unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    payment_method = Column(String, default="Cash", nullable=False) # "Cash", "UPI", "Bank", "Other"
    reference_number = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String, default="Active", nullable=False)      # "Active", "Cancelled"
    created_at = Column(DateTime, default=datetime.utcnow)

class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True)
    purchase_number = Column(String, unique=True, index=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    invoice_number = Column(String, nullable=True)
    purchase_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    payment_terms = Column(Integer, default=7, nullable=False) # Days to pay
    due_date = Column(DateTime, nullable=False)
    total_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    paid_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    due_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    payment_method = Column(String, default="Cash", nullable=False) # "Cash", "UPI", "Bank", "Other"
    status = Column(String, default="Active", nullable=False)      # "Active", "Cancelled", "Returned"
    slip_path = Column(String, nullable=True)                      # Photo reference
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")

class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(12, 2), default=0.00, nullable=False)
    price = Column(Numeric(12, 2), default=0.00, nullable=False)
    total = Column(Numeric(12, 2), default=0.00, nullable=False)

    purchase = relationship("Purchase", back_populates="items")

class SupplierPayment(Base):
    __tablename__ = "supplier_payments"

    id = Column(Integer, primary_key=True, index=True)
    payment_number = Column(String, unique=True, index=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    payment_method = Column(String, default="Cash", nullable=False) # "Cash", "UPI", "Bank", "Other"
    reference_number = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String, default="Active", nullable=False)      # "Active", "Cancelled"
    created_at = Column(DateTime, default=datetime.utcnow)

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=datetime.utcnow, nullable=False)
    category = Column(String, nullable=False) # e.g. "Electricity", "Rent", "Salary", "Transport", "Packaging"
    amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    payment_method = Column(String, default="Cash", nullable=False) # "Cash", "UPI", "Bank", "Other"
    description = Column(Text, nullable=True)
    attachment_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class CerealTransaction(Base):
    __tablename__ = "cereal_transactions"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    transaction_type = Column(String, nullable=False)  # "BUY" or "SELL"
    weight = Column(Numeric(12, 2), default=0.00, nullable=False)
    unit = Column(String, default="quintal", nullable=False)  # "quintal", "kg"
    rate = Column(Numeric(12, 2), default=0.00, nullable=False)
    total_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    bags = Column(Integer, nullable=True)  # optional katta count
    notes = Column(Text, nullable=True)  # optional remarks
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product")
