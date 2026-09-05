from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from ..utils.timezone import get_ist_naive

from ..database import get_db
from ..models.bill import Bill, BillItem, BillPayment, FinancialYearCounter
from ..models.product import Product
from ..models.customer import Customer
from ..models.transaction import Sale, SaleItem
from ..models.inventory import StockMovement
from ..models.user import User
from ..schemas.bill import (
    BillCalculateRequest, BillCreateRequest, BillResponse, 
    BillItemResponse, BillPaymentResponse
)
from ..services.billing_calculator import (
    calculate_bill, ItemCalculationInput, BillCalculationResult, TaxSlabSummary
)
from ..services.customer_sync import sync_customer_sales_and_payments
from ..dependencies.auth import get_current_user

router = APIRouter(prefix="/bills", tags=["bills"])

def get_next_bill_number(db: Session, date: Optional[datetime] = None) -> tuple[str, str]:
    """
    Generates a gapless, sequential GST-compliant bill number per Indian Financial Year (Apr 1 - Mar 31).
    Format: GT/26-27/0001
    """
    if date is None:
        date = get_ist_naive()
    
    year = date.year
    month = date.month
    if month >= 4:
        fy = f"{year}-{year+1}"
        short_fy = f"{str(year)[-2:]}-{str(year+1)[-2:]}"
    else:
        fy = f"{year-1}-{year}"
        short_fy = f"{str(year-1)[-2:]}-{str(year)[-2:]}"

    try:
        counter = db.query(FinancialYearCounter).filter(FinancialYearCounter.financial_year == fy).with_for_update().first()
    except Exception:
        counter = db.query(FinancialYearCounter).filter(FinancialYearCounter.financial_year == fy).first()

    if not counter:
        counter = FinancialYearCounter(financial_year=fy, last_number=1)
        db.add(counter)
        db.flush()
        num = 1
    else:
        counter.last_number += 1
        num = counter.last_number

    bill_no = f"GT/{short_fy}/{num:04d}"
    return bill_no, fy

@router.post("/calculate")
def preview_bill_calculation(
    req: BillCalculateRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Server-side preview and recalculation for POS cart.
    Calculates exact GST slabs, line totals, and round-off in integer paise.
    """
    calc_items = [
        ItemCalculationInput(
            product_id=it.product_id,
            product_name=it.product_name,
            barcode=it.barcode,
            hsn_code=it.hsn_code,
            unit=it.unit,
            qty=it.qty,
            mrp=it.mrp,
            sale_price=it.sale_price,
            tax_rate=it.tax_rate,
            is_tax_inclusive=it.is_tax_inclusive,
            discount_pct=it.discount_pct,
            discount_amt=it.discount_amt
        )
        for it in req.items
    ]

    calc_res = calculate_bill(
        items=calc_items,
        bill_discount_rupees=req.bill_discount,
        is_interstate=req.is_interstate
    )

    return calc_res

@router.post("/finalize", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
def finalize_bill(
    req: BillCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Finalizes and creates an atomic GST bill:
    1. Validates products & customer.
    2. Re-runs server calculation in integer paise.
    3. Generates sequential FY bill number.
    4. Records Bill, BillItem, and BillPayment.
    5. Deducts inventory & creates StockMovement.
    6. Synchronizes customer balance and creates corresponding Sale record for complete flow.
    """
    if not req.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot finalize empty bill.")

    customer = None
    if req.customer_id:
        customer = db.query(Customer).filter(Customer.id == req.customer_id, Customer.status == "Active").first()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")

    # Validate products & prepare calculation input
    calc_items: List[ItemCalculationInput] = []
    product_map = {}
    for item_in in req.items:
        prod = None
        if item_in.product_id:
            prod = db.query(Product).filter(Product.id == item_in.product_id, Product.status == "Active").first()
            if not prod:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product ID {item_in.product_id} not found.")
            product_map[item_in.product_id] = prod

        calc_items.append(ItemCalculationInput(
            product_id=item_in.product_id,
            product_name=prod.name if prod else item_in.product_name,
            barcode=prod.barcode if prod else item_in.barcode,
            hsn_code=prod.hsn_code if prod else item_in.hsn_code,
            unit=prod.unit if prod else item_in.unit,
            qty=item_in.qty,
            mrp=prod.mrp if (prod and prod.mrp) else item_in.mrp,
            sale_price=item_in.sale_price or (prod.selling_price if prod else Decimal("0.00")),
            tax_rate=prod.tax_rate if (prod and prod.tax_rate is not None) else item_in.tax_rate,
            is_tax_inclusive=prod.is_tax_inclusive if prod else item_in.is_tax_inclusive,
            discount_pct=item_in.discount_pct,
            discount_amt=item_in.discount_amt
        ))

    # Run integer paise calculation engine
    calc_res: BillCalculationResult = calculate_bill(
        items=calc_items,
        bill_discount_rupees=req.bill_discount,
        is_interstate=req.is_interstate
    )

    # Process payments
    total_paid_paise = 0
    bill_payment_objs = []
    payment_modes = set()

    for p in req.payments:
        amt_paise = max(0, int(Decimal(str(p.amount)) * Decimal("100")))
        if amt_paise > 0:
            total_paid_paise += amt_paise
            payment_modes.add(p.mode)
            bill_payment_objs.append(BillPayment(
                mode=p.mode,
                amount_paise=amt_paise,
                upi_ref_id=p.upi_ref_id,
                created_at=get_ist_naive()
            ))

    # If no payments specified (e.g. Credit sale)
    if not req.payments:
        payment_mode_summary = "Credit"
    elif len(payment_modes) == 1:
        payment_mode_summary = list(payment_modes)[0]
    else:
        payment_mode_summary = "Split"

    grand_total_paise = calc_res.grand_total_paise
    due_amount_paise = max(0, grand_total_paise - total_paid_paise)

    # Credit limit check for customer
    if due_amount_paise > 0 and customer and customer.payment_type == "Monthly Credit":
        due_rupees = Decimal(due_amount_paise) / Decimal("100")
        if customer.credit_limit > 0 and (customer.current_balance + due_rupees) > customer.credit_limit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Bill exceeds customer credit limit of Rs. {customer.credit_limit}. Current balance: Rs. {customer.current_balance}"
            )

    if due_amount_paise == 0:
        payment_status = "PAID"
    elif total_paid_paise > 0:
        payment_status = "PARTIALLY PAID"
    else:
        payment_status = "DUE"

    bill_no, fy = get_next_bill_number(db)

    bill = Bill(
        bill_no=bill_no,
        financial_year=fy,
        date=get_ist_naive(),
        created_at=get_ist_naive(),
        customer_id=req.customer_id,
        customer_name=customer.name if customer else (req.customer_name or "Walk-in Customer (नकद ग्राहक)"),
        customer_gstin=customer.gstin if (customer and hasattr(customer, "gstin")) else req.customer_gstin,
        is_interstate=req.is_interstate,
        subtotal_paise=calc_res.subtotal_paise,
        total_discount_paise=calc_res.total_discount_paise,
        taxable_paise=calc_res.taxable_paise,
        cgst_paise=calc_res.cgst_paise,
        sgst_paise=calc_res.sgst_paise,
        igst_paise=calc_res.igst_paise,
        total_tax_paise=calc_res.tax_paise,
        round_off_paise=calc_res.round_off_paise,
        grand_total_paise=grand_total_paise,
        paid_amount_paise=total_paid_paise,
        due_amount_paise=due_amount_paise,
        payment_mode=payment_mode_summary,
        payment_status=payment_status,
        created_by_id=current_user.id if current_user else None,
        status="Active",
        notes=req.notes
    )
    db.add(bill)
    db.flush()

    # Add line items
    for item in calc_res.items:
        bill_item = BillItem(
            bill_id=bill.id,
            product_id=item.product_id,
            barcode=item.barcode,
            product_name=item.product_name,
            hsn_code=item.hsn_code,
            qty=item.qty,
            unit=item.unit,
            mrp_paise=item.mrp_paise,
            sale_price_paise=item.sale_price_paise,
            gross_paise=item.gross_paise,
            line_discount_paise=item.line_discount_paise,
            allocated_bill_discount_paise=item.allocated_bill_discount_paise,
            taxable_paise=item.taxable_paise,
            tax_rate=item.tax_rate,
            is_tax_inclusive=item.is_tax_inclusive,
            cgst_rate=item.cgst_rate,
            cgst_paise=item.cgst_paise,
            sgst_rate=item.sgst_rate,
            sgst_paise=item.sgst_paise,
            igst_rate=item.igst_rate,
            igst_paise=item.igst_paise,
            tax_paise=item.tax_paise,
            line_total_paise=item.line_total_paise
        )
        db.add(bill_item)

        # Inventory deduction
        if item.product_id and item.product_id in product_map:
            prod = product_map[item.product_id]
            prod.current_stock -= item.qty
            
            movement = StockMovement(
                product_id=prod.id,
                movement_type="SALE",
                quantity=-item.qty,
                reference_id=bill.id,
                reference_type="Bill",
                notes=f"Sold via GST Invoice {bill_no}"
            )
            db.add(movement)

    # Add payments
    for p_obj in bill_payment_objs:
        p_obj.bill_id = bill.id
        db.add(p_obj)

    # Create matching Sale entry so Transactions History and Reports stay 100% unified
    counter_paid_rupees = Decimal(total_paid_paise) / Decimal("100")
    total_amount_rupees = Decimal(grand_total_paise) / Decimal("100")
    subtotal_rupees = Decimal(calc_res.subtotal_paise) / Decimal("100")
    discount_rupees = Decimal(calc_res.total_discount_paise) / Decimal("100")
    due_rupees = Decimal(due_amount_paise) / Decimal("100")

    matching_sale = Sale(
        sale_number=bill_no,
        customer_id=req.customer_id,
        sale_date=bill.date,
        subtotal=subtotal_rupees,
        discount=discount_rupees,
        total_amount=total_amount_rupees,
        counter_paid=counter_paid_rupees,
        paid_amount=counter_paid_rupees,
        due_amount=due_rupees,
        payment_method=payment_mode_summary,
        payment_status=payment_status,
        created_at=get_ist_naive(),
        status="Active"
    )
    db.add(matching_sale)
    db.flush()

    for item in calc_res.items:
        if item.product_id:
            s_item = SaleItem(
                sale_id=matching_sale.id,
                product_id=item.product_id,
                quantity=item.qty,
                price=item.sale_price,
                total=item.line_total
            )
            db.add(s_item)

    # Synchronize customer ledger if customer sale
    if req.customer_id:
        sync_customer_sales_and_payments(req.customer_id, db)

    db.commit()
    db.refresh(bill)

    # Format response
    return format_bill_response(bill, calc_res.tax_slabs)

def format_bill_response(bill: Bill, tax_slabs: Optional[List[TaxSlabSummary]] = None) -> BillResponse:
    items_resp = [
        BillItemResponse(
            id=it.id,
            product_id=it.product_id,
            barcode=it.barcode,
            product_name=it.product_name,
            hsn_code=it.hsn_code,
            qty=float(it.qty),
            unit=it.unit,
            mrp=it.mrp_paise / 100.0,
            sale_price=it.sale_price_paise / 100.0,
            gross_amount=it.gross_paise / 100.0,
            discount_amount=(it.line_discount_paise + it.allocated_bill_discount_paise) / 100.0,
            taxable_amount=it.taxable_paise / 100.0,
            tax_rate=float(it.tax_rate),
            is_tax_inclusive=it.is_tax_inclusive,
            cgst_rate=float(it.cgst_rate),
            cgst_amount=it.cgst_paise / 100.0,
            sgst_rate=float(it.sgst_rate),
            sgst_amount=it.sgst_paise / 100.0,
            igst_rate=float(it.igst_rate),
            igst_amount=it.igst_paise / 100.0,
            tax_amount=it.tax_paise / 100.0,
            line_total=it.line_total_paise / 100.0
        )
        for it in bill.items
    ]

    payments_resp = [
        BillPaymentResponse(
            id=p.id,
            mode=p.mode,
            amount=p.amount_paise / 100.0,
            upi_ref_id=p.upi_ref_id,
            created_at=p.created_at
        )
        for p in bill.payments
    ]

    if tax_slabs is None:
        # Reconstruct tax slabs from line items
        slab_map = {}
        for it in bill.items:
            rate = Decimal(str(it.tax_rate))
            if rate not in slab_map:
                slab_map[rate] = {"taxable": 0, "cgst": 0, "sgst": 0, "igst": 0, "tax": 0}
            slab_map[rate]["taxable"] += it.taxable_paise
            slab_map[rate]["cgst"] += it.cgst_paise
            slab_map[rate]["sgst"] += it.sgst_paise
            slab_map[rate]["igst"] += it.igst_paise
            slab_map[rate]["tax"] += it.tax_paise

        tax_slabs = [
            TaxSlabSummary(
                tax_rate=rate,
                taxable_paise=data["taxable"],
                cgst_paise=data["cgst"],
                sgst_paise=data["sgst"],
                igst_paise=data["igst"],
                tax_paise=data["tax"],
                taxable_amount=Decimal(data["taxable"]) / Decimal("100"),
                cgst_amount=Decimal(data["cgst"]) / Decimal("100"),
                sgst_amount=Decimal(data["sgst"]) / Decimal("100"),
                igst_amount=Decimal(data["igst"]) / Decimal("100"),
                tax_amount=Decimal(data["tax"]) / Decimal("100")
            )
            for rate, data in sorted(slab_map.items())
        ]

    return BillResponse(
        id=bill.id,
        bill_no=bill.bill_no,
        financial_year=bill.financial_year,
        date=bill.date,
        customer_id=bill.customer_id,
        customer_name=bill.customer_name,
        customer_gstin=bill.customer_gstin,
        is_interstate=bill.is_interstate,
        subtotal=bill.subtotal_paise / 100.0,
        total_discount=bill.total_discount_paise / 100.0,
        taxable_amount=bill.taxable_paise / 100.0,
        cgst_amount=bill.cgst_paise / 100.0,
        sgst_amount=bill.sgst_paise / 100.0,
        igst_amount=bill.igst_paise / 100.0,
        total_tax_amount=bill.total_tax_paise / 100.0,
        round_off=bill.round_off_paise / 100.0,
        grand_total=bill.grand_total_paise / 100.0,
        paid_amount=bill.paid_amount_paise / 100.0,
        due_amount=bill.due_amount_paise / 100.0,
        payment_mode=bill.payment_mode,
        payment_status=bill.payment_status,
        status=bill.status,
        cancelled_reason=bill.cancelled_reason,
        notes=bill.notes,
        created_at=bill.created_at,
        items=items_resp,
        payments=payments_resp,
        tax_slabs=tax_slabs
    )

@router.get("/", response_model=List[BillResponse])
def list_bills(
    customer_id: Optional[int] = None,
    financial_year: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Bill)
    if customer_id:
        query = query.filter(Bill.customer_id == customer_id)
    if financial_year:
        query = query.filter(Bill.financial_year == financial_year)
    bills = query.order_by(Bill.date.desc(), Bill.id.desc()).limit(100).all()
    return [format_bill_response(b) for b in bills]

@router.get("/{bill_id}", response_model=BillResponse)
def get_bill(
    bill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found.")
    return format_bill_response(bill)

@router.post("/{bill_id}/void")
def void_bill(
    bill_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["Admin", "Staff"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.status == "Active").first()
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active bill not found.")

    bill.status = "Cancelled"
    bill.cancelled_reason = reason or "Voided by user"

    # Reverse inventory
    for item in bill.items:
        if item.product_id:
            prod = db.query(Product).filter(Product.id == item.product_id).first()
            if prod:
                prod.current_stock += item.qty
                movement = StockMovement(
                    product_id=prod.id,
                    movement_type="CANCEL_SALE",
                    quantity=item.qty,
                    reference_id=bill.id,
                    reference_type="Bill",
                    notes=f"Bill voided: {bill.bill_no}"
                )
                db.add(movement)

    # Cancel matching Sale
    matching_sale = db.query(Sale).filter(Sale.sale_number == bill.bill_no, Sale.status == "Active").first()
    if matching_sale:
        matching_sale.status = "Cancelled"
        matching_sale.cancelled_reason = reason or "Voided with bill"

    if bill.customer_id:
        sync_customer_sales_and_payments(bill.customer_id, db)

    db.commit()
    return {"message": f"Bill {bill.bill_no} voided and reversed successfully."}
