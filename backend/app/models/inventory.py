from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, ForeignKey
from datetime import datetime as dt
from ..utils.timezone import get_ist_naive
class datetime(dt):
    @classmethod
    def utcnow(cls):
        return get_ist_naive()
from ..database import Base

class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    movement_type = Column(String, nullable=False) # "PURCHASE", "SALE", "RETURN", "DAMAGE", "EXPIRY", "ADJUSTMENT", "OTHER"
    quantity = Column(Numeric(12, 2), nullable=False) # +ve for inputs, -ve for outputs
    reference_id = Column(Integer, nullable=True)     # sale_items.id, purchase_items.id, etc.
    reference_type = Column(String, nullable=True)   # "SaleItem", "PurchaseItem", "Manual"
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
