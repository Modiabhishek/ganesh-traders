from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from decimal import Decimal

class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1)

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    name: str = Field(..., min_length=1)
    category_id: int
    brand: Optional[str] = None
    barcode: Optional[str] = None
    unit: str = Field("piece", pattern="^(kg|gram|litre|ml|piece|packet|box|dozen|bag|quintal)$")
    pack_size: Optional[str] = None
    purchase_price: Decimal = Field(default=Decimal("0.00"))
    selling_price: Decimal = Field(default=Decimal("0.00"))
    mrp: Optional[Decimal] = Field(default=Decimal("0.00"))
    tax_rate: Decimal = Field(default=Decimal("0.00"))
    is_tax_inclusive: bool = Field(default=True)
    hsn_code: Optional[str] = None
    allow_backorder: bool = Field(default=True)
    minimum_stock: Decimal = Field(default=Decimal("0.00"))
    notes: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[int] = None
    brand: Optional[str] = None
    barcode: Optional[str] = None
    unit: Optional[str] = Field(None, pattern="^(kg|gram|litre|ml|piece|packet|box|dozen|bag|quintal)$")
    pack_size: Optional[str] = None
    purchase_price: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    is_tax_inclusive: Optional[bool] = None
    hsn_code: Optional[str] = None
    allow_backorder: Optional[bool] = None
    minimum_stock: Optional[Decimal] = None
    current_stock: Optional[Decimal] = None
    status: Optional[str] = Field(None, pattern="^(Active|Inactive)$")
    notes: Optional[str] = None

class ProductResponse(ProductBase):
    id: int
    product_code: str
    barcode: Optional[str] = None
    current_stock: Decimal
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
