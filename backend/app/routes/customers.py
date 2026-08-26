import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
from ..database import get_db
from ..models.customer import Customer, LiveUpdate
from ..models.transaction import Sale, CustomerPayment
from ..schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerImportPreview
from ..services.customer_import import parse_csv_for_preview
from ..dependencies.auth import get_current_user
from ..models.user import User
from ..services.auth import get_password_hash

router = APIRouter(prefix="/customers", tags=["customers"])

def generate_customer_code(db: Session) -> str:
    # Generates a sequential customer code CUST-00001
    count = db.query(Customer).count()
    return f"CUST-{count + 1:05d}"

@router.get("/", response_model=List[CustomerResponse])
def get_customers(
    search: Optional[str] = None,
    customer_type: Optional[str] = None,
    payment_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Customer).filter(Customer.status == "Active")
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            Customer.name.ilike(search_filter) |
            Customer.mobile.ilike(search_filter) |
            Customer.customer_code.ilike(search_filter)
        )
    if customer_type:
        query = query.filter(Customer.customer_type == customer_type)
    if payment_type:
        query = query.filter(Customer.payment_type == payment_type)

    return query.all()

@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    customer_in: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Enforce mobile uniqueness for Active users
    if customer_in.mobile:
        dup = db.query(Customer).filter(Customer.mobile == customer_in.mobile, Customer.status == "Active").first()
        if dup:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Customer with mobile {customer_in.mobile} already exists.")

    if customer_in.portal_username:
        dup_u = db.query(User).filter(func.lower(User.username) == func.lower(customer_in.portal_username), User.status == "Active").first()
        dup_c = db.query(Customer).filter(func.lower(Customer.portal_username) == func.lower(customer_in.portal_username), Customer.status == "Active").first()
        if dup_u or dup_c:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Portal username already exists.")

    pw_hash = None
    if customer_in.portal_password:
        pw_hash = get_password_hash(customer_in.portal_password)

    code = generate_customer_code(db)
    new_cust = Customer(
        customer_code=code,
        name=customer_in.name,
        mobile=customer_in.mobile,
        address=customer_in.address,
        customer_type=customer_in.customer_type,
        payment_type=customer_in.payment_type,
        opening_balance=customer_in.opening_balance,
        current_balance=customer_in.opening_balance,
        credit_limit=customer_in.credit_limit,
        notes=customer_in.notes,
        fathers_name=customer_in.fathers_name,
        reference=customer_in.reference,
        portal_username=customer_in.portal_username,
        portal_password_hash=pw_hash,
        portal_status=customer_in.portal_status or "Blocked"
    )
    db.add(new_cust)
    db.commit()
    db.refresh(new_cust)
    return new_cust

@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cust = db.query(Customer).filter(Customer.id == customer_id, Customer.status == "Active").first()
    if not cust:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")
    return cust

@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    customer_in: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cust = db.query(Customer).filter(Customer.id == customer_id, Customer.status == "Active").first()
    if not cust:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")

    update_data = customer_in.model_dump(exclude_unset=True)

    if "portal_username" in update_data and update_data["portal_username"]:
        username = update_data["portal_username"]
        dup_u = db.query(User).filter(func.lower(User.username) == func.lower(username), User.status == "Active").first()
        dup_c = db.query(Customer).filter(func.lower(Customer.portal_username) == func.lower(username), Customer.status == "Active", Customer.id != customer_id).first()
        if dup_u or dup_c:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Portal username already exists.")

    if "portal_password" in update_data:
        pw = update_data.pop("portal_password")
        if pw:
            cust.portal_password_hash = get_password_hash(pw)

    for field, val in update_data.items():
        setattr(cust, field, val)

    db.commit()
    db.refresh(cust)
    return cust

@router.post("/import-preview", response_model=CustomerImportPreview)
async def import_preview(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    contents = await file.read()
    return parse_csv_for_preview(contents, db)

@router.post("/import-confirm", status_code=status.HTTP_201_CREATED)
def import_confirm(
    rows: List[CustomerCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    imported_count = 0
    for r in rows:
        # Prevent importing rows with duplicate mobile numbers if mobile already exists in DB
        if r.mobile:
            dup = db.query(Customer).filter(Customer.mobile == r.mobile, Customer.status == "Active").first()
            if dup:
                continue

        code = generate_customer_code(db)
        new_cust = Customer(
            customer_code=code,
            name=r.name,
            mobile=r.mobile,
            address=r.address,
            customer_type=r.customer_type,
            payment_type=r.payment_type,
            opening_balance=r.opening_balance,
            current_balance=r.opening_balance,
            credit_limit=r.credit_limit,
            notes=r.notes,
            fathers_name=r.fathers_name,
            reference=r.reference
        )
        db.add(new_cust)
        db.commit() # Commit sequentially to generate correct incremental codes
        imported_count += 1

    return {"message": f"Successfully imported {imported_count} customers."}

@router.get("/{customer_id}/ledger")
def get_customer_ledger(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role == "Customer" and customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. You can only view your own ledger.")

    cust = db.query(Customer).filter(Customer.id == customer_id, Customer.status == "Active").first()
    if not cust:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")

    sales = db.query(Sale).filter(Sale.customer_id == customer_id, Sale.status == "Active").all()
    payments = db.query(CustomerPayment).filter(CustomerPayment.customer_id == customer_id, CustomerPayment.status == "Active").all()

    # Collect ledger entries
    transactions = []

    # Inject opening balance row as the first transaction line
    transactions.append({
        "date": cust.created_at,
        "type": "Opening Balance",
        "reference": "N/A",
        "debit": cust.opening_balance,
        "credit": Decimal("0.00"),
        "notes": "Opening balance at Go-Live",
        "items": []
    })

    for s in sales:
        items_list = [
            {
                "product_name": item.product.name,
                "quantity": float(item.quantity),
                "price": float(item.price),
                "total": float(item.total),
                "unit": item.product.unit
            } for item in s.items
        ]
        transactions.append({
            "date": s.sale_date,
            "type": "Sale",
            "reference": s.sale_number,
            "debit": s.total_amount,
            "credit": Decimal("0.00"),
            "notes": f"Invoice via {s.payment_method}",
            "items": items_list
        })
        if s.paid_amount > 0:
            transactions.append({
                "date": s.sale_date,
                "type": "Payment (Sale)",
                "reference": s.sale_number,
                "debit": Decimal("0.00"),
                "credit": s.paid_amount,
                "notes": f"Paid at time of sale",
                "items": []
            })

    for p in payments:
        transactions.append({
            "date": p.payment_date,
            "type": "Payment",
            "reference": p.payment_number,
            "debit": Decimal("0.00"),
            "credit": p.amount,
            "notes": p.notes or f"Paid via {p.payment_method}",
            "items": []
        })

    # Sort chronological
    transactions.sort(key=lambda x: x["date"])

    # Calculate ledger run-rate
    running_bal = Decimal("0.00")
    for idx, t in enumerate(transactions):
        if idx == 0:
            running_bal = cust.opening_balance
            t["running_balance"] = running_bal
        else:
            running_bal = running_bal + t["debit"] - t["credit"]
            t["running_balance"] = running_bal

    return {
        "customer": {
            "id": cust.id,
            "name": cust.name,
            "customer_code": cust.customer_code,
            "mobile": cust.mobile,
            "opening_balance": cust.opening_balance,
            "current_balance": cust.current_balance
        },
        "ledger": transactions
    }

@router.delete("/{customer_id}", status_code=status.HTTP_200_OK)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cust = db.query(Customer).filter(Customer.id == customer_id, Customer.status == "Active").first()
    if not cust:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")
    
    # Soft delete: set status to Inactive
    cust.status = "Inactive"
    cust.portal_username = None
    cust.portal_status = "Blocked"
    if cust.mobile:
        import time
        # Append timestamp to allow reusing this mobile number for other customers
        cust.mobile = f"{cust.mobile}_deleted_{int(time.time())}"
        
    db.commit()
    return {"message": "Customer deactivated successfully and username/mobile freed up."}

@router.get("/portal/profile", response_model=CustomerResponse)
def get_portal_profile(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role != "Customer":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only customers can view this profile.")
    cust = db.query(Customer).filter(Customer.id == current_user.id, Customer.status == "Active").first()
    if not cust:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")
    return cust

from pydantic import BaseModel
class LiveUpdateCreate(BaseModel):
    title: str
    content: str

@router.get("/live-updates/all")
def get_live_updates(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return db.query(LiveUpdate).order_by(LiveUpdate.created_at.desc()).all()

@router.post("/live-updates/add")
def create_live_update(
    update_in: LiveUpdateCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role not in ["Admin", "Staff"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")
    new_update = LiveUpdate(title=update_in.title, content=update_in.content)
    db.add(new_update)
    db.commit()
    db.refresh(new_update)
    return new_update

@router.delete("/live-updates/{update_id}")
def delete_live_update(
    update_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role not in ["Admin", "Staff"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")
    update = db.query(LiveUpdate).filter(LiveUpdate.id == update_id).first()
    if not update:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Update not found.")
    db.delete(update)
    db.commit()
    return {"message": "Update deleted successfully."}
