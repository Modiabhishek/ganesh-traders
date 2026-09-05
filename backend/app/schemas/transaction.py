from pydantic import BaseModel, Field, model_validator
from datetime import datetime
from typing import Optional, List
from decimal import Decimal

class SaleItemCreate(BaseModel):
    product_id: int
    quantity: Decimal
    price: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None

    @model_validator(mode="before")
    @classmethod
    def resolve_fields(cls, data):
        if isinstance(data, dict):
            if data.get("price") is None and data.get("unit_price") is not None:
                data["price"] = data["unit_price"]
        return data

class SaleItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: Decimal
    price: Decimal
    total: Decimal
    product_name: Optional[str] = None
    unit: Optional[str] = None

    class Config:
        from_attributes = True

class SaleCreate(BaseModel):
    customer_id: Optional[int] = None # Nullable for walk-in cash customer
    sale_date: Optional[datetime] = None
    items: List[SaleItemCreate]
    discount: Decimal = Decimal("0.00")
    paid_amount: Decimal = Decimal("0.00")
    payment_method: str = Field("Cash", pattern="^(Cash|UPI|Card|Credit)$")
    payment_mode: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def resolve_payment(cls, data):
        if isinstance(data, dict):
            if not data.get("payment_method") and data.get("payment_mode"):
                data["payment_method"] = data["payment_mode"]
        return data

class SaleResponse(BaseModel):
    id: int
    sale_number: str
    customer_id: Optional[int]
    customer_name: Optional[str] = None
    sale_date: datetime
    subtotal: Decimal
    discount: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    due_amount: Decimal
    payment_method: str
    payment_status: str
    status: str
    cancelled_reason: Optional[str]
    items: List[SaleItemResponse]
    created_at: datetime

    class Config:
        from_attributes = True

class SaleUpdate(BaseModel):
    discount: Decimal = Decimal("0.00")
    paid_amount: Decimal = Decimal("0.00")
    payment_method: str = Field("Cash", pattern="^(Cash|UPI|Card|Credit)$")

class CustomerPaymentCreate(BaseModel):
    customer_id: int
    payment_date: Optional[datetime] = None
    amount: Decimal = Field(..., gt=0)
    payment_method: str = Field("Cash", pattern="^(Cash|UPI|Bank|Other)$")
    reference_number: Optional[str] = None
    notes: Optional[str] = None

class CustomerPaymentResponse(BaseModel):
    id: int
    payment_number: str
    customer_id: int
    customer_name: Optional[str] = None
    payment_date: datetime
    amount: Decimal
    payment_method: str
    reference_number: Optional[str]
    notes: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class PurchaseItemCreate(BaseModel):
    product_id: int
    quantity: Decimal
    price: Decimal

class PurchaseItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: Decimal
    price: Decimal
    total: Decimal

    class Config:
        from_attributes = True

class PurchaseCreate(BaseModel):
    supplier_id: int
    invoice_number: Optional[str] = None
    purchase_date: Optional[datetime] = None
    payment_terms: int = 7
    items: List[PurchaseItemCreate]
    paid_amount: Decimal = Decimal("0.00")
    payment_method: str = Field("Cash", pattern="^(Cash|UPI|Bank|Other)$")

class PurchaseResponse(BaseModel):
    id: int
    purchase_number: str
    supplier_id: int
    invoice_number: Optional[str]
    purchase_date: datetime
    payment_terms: int
    due_date: datetime
    total_amount: Decimal
    paid_amount: Decimal
    due_amount: Decimal
    payment_method: str
    status: str
    slip_path: Optional[str]
    items: List[PurchaseItemResponse]
    created_at: datetime

    class Config:
        from_attributes = True

class SupplierPaymentCreate(BaseModel):
    supplier_id: int
    payment_date: Optional[datetime] = None
    amount: Decimal = Field(..., gt=0)
    payment_method: str = Field("Cash", pattern="^(Cash|UPI|Bank|Other)$")
    reference_number: Optional[str] = None
    notes: Optional[str] = None

class SupplierPaymentResponse(BaseModel):
    id: int
    payment_number: str
    supplier_id: int
    payment_date: datetime
    amount: Decimal
    payment_method: str
    reference_number: Optional[str]
    notes: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class ExpenseCreate(BaseModel):
    date: Optional[datetime] = None
    category: str
    amount: Decimal = Field(..., gt=0)
    payment_method: str = Field("Cash", pattern="^(Cash|UPI|Bank|Other)$")
    description: Optional[str] = None

class ExpenseResponse(BaseModel):
    id: int
    date: datetime
    category: str
    amount: Decimal
    payment_method: str
    description: Optional[str]
    attachment_path: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class CerealTransactionCreate(BaseModel):
    product_id: int
    transaction_type: str = Field(..., pattern="^(BUY|SELL)$")
    weight: Decimal = Field(..., gt=0)
    unit: str = Field("quintal", pattern="^(quintal|kg)$")
    rate: Decimal = Field(..., gt=0)
    bags: Optional[int] = None
    notes: Optional[str] = None

class CerealTransactionResponse(BaseModel):
    id: int
    product_id: int
    transaction_type: str
    weight: Decimal
    unit: str
    rate: Decimal
    total_amount: Decimal
    bags: Optional[int]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
