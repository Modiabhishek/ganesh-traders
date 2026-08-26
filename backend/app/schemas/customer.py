from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from decimal import Decimal

class CustomerBase(BaseModel):
    name: str = Field(..., min_length=1)
    mobile: Optional[str] = None # We validate phone inside the custom logic, but Pydantic regex pattern works too
    address: Optional[str] = None
    customer_type: str = Field("Retail", pattern="^(Retail|Wholesale)$")
    payment_type: str = Field("Cash", pattern="^(Cash|Monthly Credit|Other)$")
    opening_balance: Decimal = Field(default=Decimal("0.00"))
    credit_limit: Decimal = Field(default=Decimal("0.00"))
    fathers_name: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None

class CustomerCreate(CustomerBase):
    portal_username: Optional[str] = None
    portal_password: Optional[str] = None
    portal_status: Optional[str] = "Blocked"

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    customer_type: Optional[str] = Field(None, pattern="^(Retail|Wholesale)$")
    payment_type: Optional[str] = Field(None, pattern="^(Cash|Monthly Credit|Other)$")
    credit_limit: Optional[Decimal] = None
    status: Optional[str] = Field(None, pattern="^(Active|Inactive)$")
    fathers_name: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    portal_username: Optional[str] = None
    portal_password: Optional[str] = None
    portal_status: Optional[str] = Field(None, pattern="^(Allowed|Blocked)$")

class CustomerResponse(CustomerBase):
    id: int
    customer_code: str
    current_balance: Decimal
    status: str
    portal_username: Optional[str]
    portal_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CustomerImportRow(BaseModel):
    row_index: int
    name: str
    mobile: Optional[str] = None
    address: Optional[str] = None
    customer_type: str = "Retail"
    payment_type: str = "Cash"
    opening_balance: Decimal = Decimal("0.00")
    credit_limit: Decimal = Decimal("0.00")
    fathers_name: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    errors: List[str] = []
    warnings: List[str] = []
    is_duplicate: bool = False
    duplicate_reason: Optional[str] = None

class CustomerImportPreview(BaseModel):
    total_rows: int
    valid_count: int
    warning_count: int
    error_count: int
    duplicate_count: int
    rows: List[CustomerImportRow]
