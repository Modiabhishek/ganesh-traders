from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime as dt
from ..utils.timezone import get_ist_naive
class datetime(dt):
    @classmethod
    def utcnow(cls):
        return get_ist_naive()
from ..database import Base

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="Active", nullable=False) # "Active", "Inactive"
    created_at = Column(DateTime, default=datetime.utcnow)

    products = relationship("Product", back_populates="category")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_code = Column(String, unique=True, index=True, nullable=False)
    barcode = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, index=True, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    brand = Column(String, nullable=True)
    unit = Column(String, default="piece", nullable=False) # "kg", "gram", "litre", "ml", "piece", "packet", "box", "dozen"
    pack_size = Column(String, nullable=True) # e.g. "5 kg", "2 L"
    purchase_price = Column(Numeric(12, 2), default=0.00, nullable=False)
    selling_price = Column(Numeric(12, 2), default=0.00, nullable=False)
    mrp = Column(Numeric(12, 2), default=0.00, nullable=True)
    tax_rate = Column(Numeric(5, 2), default=0.00, nullable=False) # 0, 5, 12, 18, 28
    is_tax_inclusive = Column(Boolean, default=True, nullable=False)
    hsn_code = Column(String, nullable=True)
    allow_backorder = Column(Boolean, default=True, nullable=False)
    minimum_stock = Column(Numeric(12, 2), default=0.00, nullable=False)
    current_stock = Column(Numeric(12, 2), default=0.00, nullable=False)
    status = Column(String, default="Active", nullable=False) # "Active", "Inactive"
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = relationship("Category", back_populates="products")
