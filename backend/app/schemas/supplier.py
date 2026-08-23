from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from decimal import Decimal

class SupplierBase(BaseModel):
    name: str = Field(..., min_length=1)
    mobile: Optional[str] = None
    address: Optional[str] = None
    payment_terms: int = Field(7, ge=0) # Days to pay (e.g. 7 days)
    notes: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    payment_terms: Optional[int] = None
    status: Optional[str] = Field(None, pattern="^(Active|Inactive)$")
    notes: Optional[str] = None

class SupplierResponse(SupplierBase):
    id: int
    supplier_code: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
