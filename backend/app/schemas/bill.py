from pydantic import BaseModel, Field
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from ..services.billing_calculator import TaxSlabSummary

class BillItemInput(BaseModel):
    product_id: Optional[int] = None
    barcode: Optional[str] = None
    product_name: str
    hsn_code: Optional[str] = None
    qty: Decimal = Field(default=Decimal("1.000"), gt=Decimal("0.000"))
    unit: str = "piece"
    mrp: Decimal = Decimal("0.00")
    sale_price: Decimal = Decimal("0.00")
    tax_rate: Decimal = Decimal("0.00")
    is_tax_inclusive: bool = True
    discount_pct: Decimal = Decimal("0.00")
    discount_amt: Decimal = Decimal("0.00")

class PaymentSplitInput(BaseModel):
    mode: str  # Cash, UPI, Credit, Card
    amount: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    upi_ref_id: Optional[str] = None

class BillCalculateRequest(BaseModel):
    items: List[BillItemInput]
    bill_discount: Decimal = Decimal("0.00")
    is_interstate: bool = False

class BillCreateRequest(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_gstin: Optional[str] = None
    is_interstate: bool = False
    bill_discount: Decimal = Decimal("0.00")
    items: List[BillItemInput]
    payments: List[PaymentSplitInput]
    notes: Optional[str] = None

class BillItemResponse(BaseModel):
    id: Optional[int] = None
    product_id: Optional[int] = None
    barcode: Optional[str] = None
    product_name: str
    hsn_code: Optional[str] = None
    qty: float
    unit: str
    mrp: float
    sale_price: float
    gross_amount: float
    discount_amount: float
    taxable_amount: float
    tax_rate: float
    is_tax_inclusive: bool
    cgst_rate: float
    cgst_amount: float
    sgst_rate: float
    sgst_amount: float
    igst_rate: float
    igst_amount: float
    tax_amount: float
    line_total: float

    class Config:
        from_attributes = True

class BillPaymentResponse(BaseModel):
    id: Optional[int] = None
    mode: str
    amount: float
    upi_ref_id: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class BillResponse(BaseModel):
    id: int
    bill_no: str
    financial_year: str
    date: datetime
    customer_id: Optional[int] = None
    customer_name: str
    customer_gstin: Optional[str] = None
    is_interstate: bool
    
    subtotal: float
    total_discount: float
    taxable_amount: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    total_tax_amount: float
    round_off: float
    grand_total: float
    paid_amount: float
    due_amount: float
    
    payment_mode: str
    payment_status: str
    status: str
    cancelled_reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    
    items: List[BillItemResponse] = []
    payments: List[BillPaymentResponse] = []
    tax_slabs: List[TaxSlabSummary] = []

    class Config:
        from_attributes = True
