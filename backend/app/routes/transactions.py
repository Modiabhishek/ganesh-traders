from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from ..utils.timezone import get_ist_naive
from ..database import get_db
from ..models.customer import Customer
from ..models.product import Product
from ..models.transaction import Sale, SaleItem, CustomerPayment, Expense, CerealTransaction
from ..models.inventory import StockMovement
from ..schemas.transaction import (
    SaleCreate, SaleResponse, SaleUpdate, CustomerPaymentCreate, CustomerPaymentResponse, 
    ExpenseCreate, ExpenseResponse, CerealTransactionCreate, CerealTransactionResponse
)
from ..dependencies.auth import get_current_user
from ..models.user import User

from ..models.bill import Bill
from ..utils.sequence import reset_table_sequence, sync_financial_year_counters

router = APIRouter(prefix="/transactions", tags=["transactions"])

def generate_sale_number(db: Session) -> str:
    existing = db.query(Sale.sale_number).filter(Sale.sale_number.like("SALE-%")).all()
    used_numbers = set()
    for (num_str,) in existing:
        try:
            part = num_str.split("-")[1]
            used_numbers.add(int(part))
        except (IndexError, ValueError):
            pass
    next_num = 1
    while next_num in used_numbers:
        next_num += 1
    return f"SALE-{next_num:05d}"

def generate_payment_number(db: Session) -> str:
    existing = db.query(CustomerPayment.payment_number).filter(CustomerPayment.payment_number.like("PMT-%")).all()
    used_numbers = set()
    for (num_str,) in existing:
        try:
            part = num_str.split("-")[1]
            used_numbers.add(int(part))
        except (IndexError, ValueError):
            pass
    next_num = 1
    while next_num in used_numbers:
        next_num += 1
    return f"PMT-{next_num:05d}"

from ..services.customer_sync import sync_customer_sales_and_payments

@router.post("/sales", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
def create_sale(
    sale_in: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    customer = None
    if sale_in.customer_id:
        customer = db.query(Customer).filter(Customer.id == sale_in.customer_id, Customer.status == "Active").first()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")

    subtotal = Decimal("0.00")
    sale_items_data = []

    # Verify products and build prices
    for item in sale_in.items:
        product = db.query(Product).filter(Product.id == item.product_id, Product.status == "Active").first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with ID {item.product_id} not found.")

        # In daily retail grocery shops, owners often sell item even if system stock shows 0 or negative
        # because of delays in typing supplier bills. We allow selling beyond stock but maintain log.
        item_total = item.price * item.quantity
        subtotal += item_total

        sale_items_data.append({
            "product": product,
            "quantity": item.quantity,
            "price": item.price,
            "total": item_total
        })

    total_amount = subtotal - sale_in.discount
    if total_amount < 0:
        total_amount = Decimal("0.00")

    due_amount = total_amount - sale_in.paid_amount
    if due_amount < 0:
        due_amount = Decimal("0.00")

    # Enforce credit limits for credit customers
    if customer and customer.payment_type == "Monthly Credit" and due_amount > 0:
        if customer.credit_limit > 0 and (customer.current_balance + due_amount) > customer.credit_limit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sale exceeds customer credit limit of Rs. {customer.credit_limit}. Current balance: Rs. {customer.current_balance}"
            )

    # Determine initial payment status
    if due_amount <= 0:
        payment_status = "PAID"
    elif sale_in.paid_amount > 0:
        payment_status = "PARTIALLY PAID"
    else:
        payment_status = "DUE"

    sale_num = generate_sale_number(db)

    new_sale = Sale(
        sale_number=sale_num,
        customer_id=sale_in.customer_id,
        sale_date=sale_in.sale_date or get_ist_naive(),
        subtotal=subtotal,
        discount=sale_in.discount,
        total_amount=total_amount,
        counter_paid=sale_in.paid_amount,
        paid_amount=sale_in.paid_amount,
        due_amount=due_amount,
        payment_method=sale_in.payment_method,
        payment_status=payment_status,
        created_at=get_ist_naive(),
        status="Active"
    )
    db.add(new_sale)
    db.commit() # Save sale first to get database ID

    # Create sale items, modify stock count, and log movements
    for item in sale_items_data:
        sale_item = SaleItem(
            sale_id=new_sale.id,
            product_id=item["product"].id,
            quantity=item["quantity"],
            price=item["price"],
            total=item["total"]
        )
        db.add(sale_item)

        # Subtract inventory stock
        item["product"].current_stock -= item["quantity"]

        # Log stock movement
        movement = StockMovement(
            product_id=item["product"].id,
            movement_type="SALE",
            quantity=-item["quantity"],
            reference_id=new_sale.id,
            reference_type="Sale",
            notes=f"Sold via invoice {sale_num}"
        )
        db.add(movement)

    # Synchronize customer sales and payments
    if sale_in.customer_id:
        sync_customer_sales_and_payments(sale_in.customer_id, db)

    db.commit()
    db.refresh(new_sale)
    return new_sale

@router.post("/payments", response_model=CustomerPaymentResponse, status_code=status.HTTP_201_CREATED)
def receive_payment(
    payment_in: CustomerPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    customer = db.query(Customer).filter(Customer.id == payment_in.customer_id, Customer.status == "Active").first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")

    pay_num = generate_payment_number(db)

    new_payment = CustomerPayment(
        payment_number=pay_num,
        customer_id=payment_in.customer_id,
        payment_date=payment_in.payment_date or get_ist_naive(),
        amount=payment_in.amount,
        payment_method=payment_in.payment_method,
        reference_number=payment_in.reference_number,
        notes=payment_in.notes,
        status="Active"
    )
    db.add(new_payment)
    db.flush()

    # Reconcile customer sales, settle due sales FIFO, and update customer balance
    sync_customer_sales_and_payments(payment_in.customer_id, db)

    db.commit()
    db.refresh(new_payment)
    return new_payment

@router.get("/sales", response_model=List[SaleResponse])
def list_sales(
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Sale).filter(Sale.status == "Active")
    if current_user.role == "Customer":
        query = query.filter(Sale.customer_id == current_user.id)
    elif customer_id:
        query = query.filter(Sale.customer_id == customer_id)
    return query.order_by(Sale.sale_date.desc()).all()

@router.get("/payments", response_model=List[CustomerPaymentResponse])
def list_payments(
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(CustomerPayment).filter(CustomerPayment.status == "Active")
    if current_user.role == "Customer":
        query = query.filter(CustomerPayment.customer_id == current_user.id)
    elif customer_id:
        query = query.filter(CustomerPayment.customer_id == customer_id)
    return query.order_by(CustomerPayment.payment_date.desc()).all()

def permanently_delete_sale_record(sale_id: int, db: Session, reason: Optional[str] = None):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale transaction not found.")

    sale_number = sale.sale_number
    customer_id = sale.customer_id

    # 1. Restore product inventory stock if the sale was Active
    if sale.status == "Active":
        for item in sale.items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if product:
                product.current_stock += item.quantity

    # 2. Check if this sale is linked to a POS Bill (bill_no == sale_number)
    matching_bill = db.query(Bill).filter(Bill.bill_no == sale_number).first()
    if matching_bill:
        db.query(StockMovement).filter(
            StockMovement.reference_id == matching_bill.id,
            StockMovement.reference_type == "Bill"
        ).delete(synchronize_session=False)
        db.delete(matching_bill)

    # 3. Delete StockMovement referencing this Sale
    db.query(StockMovement).filter(
        StockMovement.reference_id == sale.id,
        StockMovement.reference_type == "Sale"
    ).delete(synchronize_session=False)

    # 4. Permanently delete the Sale (SaleItem will cascade delete)
    db.delete(sale)
    db.flush()

    # 5. Re-sync customer ledger balance and FIFO payments
    if customer_id:
        sync_customer_sales_and_payments(customer_id, db)

    # 6. Reset database sequences so internal IDs are cleaned
    reset_table_sequence(db, "sales")
    reset_table_sequence(db, "bills")
    reset_table_sequence(db, "sale_items")
    reset_table_sequence(db, "bill_items")
    reset_table_sequence(db, "bill_payments")

    # 7. Re-sync FinancialYearCounter
    sync_financial_year_counters(db)

    db.commit()
    return {"message": f"Sale {sale_number} permanently deleted and Sale ID freed for reuse."}

@router.delete("/sales/{sale_id}", status_code=status.HTTP_200_OK)
def delete_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return permanently_delete_sale_record(sale_id, db)

@router.post("/sales/{sale_id}/cancel")
def cancel_sale(
    sale_id: int,
    cancelled_reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return permanently_delete_sale_record(sale_id, db, cancelled_reason)

@router.put("/sales/{sale_id}", response_model=SaleResponse)
def update_sale(
    sale_id: int,
    sale_in: SaleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["Admin", "Staff"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    sale = db.query(Sale).filter(Sale.id == sale_id, Sale.status == "Active").first()
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale transaction not found.")

    sale.discount = sale_in.discount
    sale.payment_method = sale_in.payment_method

    # Recalculate total amount
    sale.total_amount = sale.subtotal - sale_in.discount
    if sale.total_amount < Decimal("0.00"):
        sale.total_amount = Decimal("0.00")

    if sale.customer_id:
        sale.counter_paid = sale_in.paid_amount
        sync_customer_sales_and_payments(sale.customer_id, db)
    else:
        sale.paid_amount = sale_in.paid_amount
        sale.due_amount = max(Decimal("0.00"), sale.total_amount - sale_in.paid_amount)
        if sale.due_amount <= Decimal("0.00"):
            sale.payment_status = "PAID"
        elif sale.paid_amount > Decimal("0.00"):
            sale.payment_status = "PARTIALLY PAID"
        else:
            sale.payment_status = "DUE"

    db.commit()
    db.refresh(sale)
    return sale

def permanently_delete_payment_record(payment_id: int, db: Session):
    payment = db.query(CustomerPayment).filter(CustomerPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment transaction not found.")

    payment_number = payment.payment_number
    customer_id = payment.customer_id

    db.delete(payment)
    db.flush()

    if customer_id:
        sync_customer_sales_and_payments(customer_id, db)

    reset_table_sequence(db, "customer_payments")

    db.commit()
    return {"message": f"Payment {payment_number} permanently deleted and Payment ID freed for reuse."}

@router.delete("/payments/{payment_id}", status_code=status.HTTP_200_OK)
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return permanently_delete_payment_record(payment_id, db)

@router.post("/payments/{payment_id}/cancel")
def cancel_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return permanently_delete_payment_record(payment_id, db)

@router.put("/payments/{payment_id}", response_model=CustomerPaymentResponse)
def update_payment(
    payment_id: int,
    payment_in: CustomerPaymentCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role not in ["Admin", "Staff"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    payment = db.query(CustomerPayment).filter(CustomerPayment.id == payment_id, CustomerPayment.status == "Active").first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment transaction not found.")

    customer = db.query(Customer).filter(Customer.id == payment.customer_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")

    # Update payment details
    payment.amount = payment_in.amount
    payment.payment_method = payment_in.payment_method
    payment.reference_number = payment_in.reference_number
    payment.notes = payment_in.notes

    if payment.customer_id:
        sync_customer_sales_and_payments(payment.customer_id, db)

    db.commit()
    db.refresh(payment)
    return payment

@router.post("/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    expense_in: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_exp = Expense(
        date=expense_in.date or get_ist_naive(),
        category=expense_in.category,
        amount=expense_in.amount,
        payment_method=expense_in.payment_method,
        description=expense_in.description
    )
    db.add(new_exp)
    db.commit()
    db.refresh(new_exp)
    return new_exp

@router.get("/expenses", response_model=List[ExpenseResponse])
def list_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Expense).order_by(Expense.date.desc()).all()

@router.delete("/expenses/{expense_id}", status_code=status.HTTP_200_OK)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    exp = db.query(Expense).filter(Expense.id == expense_id).first()
    if not exp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense record not found.")
    db.delete(exp)
    db.commit()
    return {"message": "Expense record deleted successfully."}

@router.put("/expenses/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    expense_in: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role not in ["Admin", "Staff"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    exp = db.query(Expense).filter(Expense.id == expense_id).first()
    if not exp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense record not found.")

    exp.category = expense_in.category
    exp.amount = expense_in.amount
    exp.payment_method = expense_in.payment_method
    exp.description = expense_in.description
    if expense_in.date:
        exp.date = expense_in.date

    db.commit()
    db.refresh(exp)
    return exp

@router.post("/cereals", response_model=CerealTransactionResponse, status_code=status.HTTP_201_CREATED)
def create_cereal_transaction(
    tx_in: CerealTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == tx_in.product_id, Product.status == "Active").first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product/crop not found.")

    # Calculate total valuation amount
    total_amount = Decimal(str(tx_in.weight)) * Decimal(str(tx_in.rate))

    # Adjust product current_stock
    # Allowed units: kg and quintal (1 quintal = 100 kg)
    tx_weight = Decimal(str(tx_in.weight))
    
    # Standardize weight to product's unit for current_stock update
    weight_adjusted = tx_weight
    if tx_in.unit == "kg" and product.unit == "quintal":
        weight_adjusted = tx_weight / Decimal("100")
    elif tx_in.unit == "quintal" and product.unit == "kg":
        weight_adjusted = tx_weight * Decimal("100")

    if tx_in.transaction_type == "BUY":
        # Buying increases stock
        product.current_stock += weight_adjusted
        # Update buying rate (purchase_price)
        rate_adjusted = Decimal(str(tx_in.rate))
        if tx_in.unit == "kg" and product.unit == "quintal":
            rate_adjusted = Decimal(str(tx_in.rate)) * Decimal("100")
        elif tx_in.unit == "quintal" and product.unit == "kg":
            rate_adjusted = Decimal(str(tx_in.rate)) / Decimal("100")
        product.purchase_price = rate_adjusted
    else:
        # Selling decreases stock
        product.current_stock -= weight_adjusted
        # Update selling rate (selling_price)
        rate_adjusted = Decimal(str(tx_in.rate))
        if tx_in.unit == "kg" and product.unit == "quintal":
            rate_adjusted = Decimal(str(tx_in.rate)) * Decimal("100")
        elif tx_in.unit == "quintal" and product.unit == "kg":
            rate_adjusted = Decimal(str(tx_in.rate)) / Decimal("100")
        product.selling_price = rate_adjusted

    # Record Cereal Transaction
    new_tx = CerealTransaction(
        product_id=tx_in.product_id,
        transaction_type=tx_in.transaction_type,
        weight=tx_in.weight,
        unit=tx_in.unit,
        rate=tx_in.rate,
        total_amount=total_amount,
        bags=tx_in.bags,
        notes=tx_in.notes
    )
    db.add(new_tx)

    # Also log in StockMovement for audit logs!
    movement_type = "PURCHASE" if tx_in.transaction_type == "BUY" else "SALE"
    notes_movement = f"{tx_in.transaction_type} crop: {tx_weight} {tx_in.unit} @ ₹{tx_in.rate}"
    if tx_in.bags:
        notes_movement += f" ({tx_in.bags} Kattas/Bags)"
    if tx_in.notes:
        notes_movement += f" | Note: {tx_in.notes}"
        
    db.add(StockMovement(
        product_id=tx_in.product_id,
        movement_type=movement_type,
        quantity=weight_adjusted if tx_in.transaction_type == "BUY" else -weight_adjusted,
        reference_type="CerealTransaction",
        notes=notes_movement
    ))

    db.commit()
    db.refresh(new_tx)
    return new_tx

@router.get("/cereals", response_model=List[CerealTransactionResponse])
def get_cereal_transactions(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return db.query(CerealTransaction).order_by(CerealTransaction.created_at.desc()).all()

@router.put("/cereals/{tx_id}", response_model=CerealTransactionResponse)
def update_cereal_transaction(
    tx_id: int,
    tx_in: CerealTransactionCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role not in ["Admin", "Staff"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    tx = db.query(CerealTransaction).filter(CerealTransaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.")

    product = db.query(Product).filter(Product.id == tx.product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    # 1. Reverse the old stock change
    old_weight = Decimal(str(tx.weight))
    old_weight_adjusted = old_weight
    if tx.unit == "kg" and product.unit == "quintal":
        old_weight_adjusted = old_weight / Decimal("100")
    elif tx.unit == "quintal" and product.unit == "kg":
        old_weight_adjusted = old_weight * Decimal("100")

    if tx.transaction_type == "BUY":
        product.current_stock -= old_weight_adjusted
    else:
        product.current_stock += old_weight_adjusted

    # 2. Apply the new stock change
    new_weight = Decimal(str(tx_in.weight))
    new_weight_adjusted = new_weight
    if tx_in.unit == "kg" and product.unit == "quintal":
        new_weight_adjusted = new_weight / Decimal("100")
    elif tx_in.unit == "quintal" and product.unit == "kg":
        new_weight_adjusted = new_weight * Decimal("100")

    if tx_in.transaction_type == "BUY":
        product.current_stock += new_weight_adjusted
        rate_adjusted = Decimal(str(tx_in.rate))
        if tx_in.unit == "kg" and product.unit == "quintal":
            rate_adjusted = Decimal(str(tx_in.rate)) * Decimal("100")
        elif tx_in.unit == "quintal" and product.unit == "kg":
            rate_adjusted = Decimal(str(tx_in.rate)) / Decimal("100")
        product.purchase_price = rate_adjusted
    else:
        product.current_stock -= new_weight_adjusted
        rate_adjusted = Decimal(str(tx_in.rate))
        if tx_in.unit == "kg" and product.unit == "quintal":
            rate_adjusted = Decimal(str(tx_in.rate)) * Decimal("100")
        elif tx_in.unit == "quintal" and product.unit == "kg":
            rate_adjusted = Decimal(str(tx_in.rate)) / Decimal("100")
        product.selling_price = rate_adjusted

    # 3. Update CerealTransaction record
    tx.weight = tx_in.weight
    tx.unit = tx_in.unit
    tx.rate = tx_in.rate
    tx.total_amount = Decimal(str(tx_in.weight)) * Decimal(str(tx_in.rate))
    tx.bags = tx_in.bags
    tx.notes = tx_in.notes
    tx.transaction_type = tx_in.transaction_type
    tx.product_id = tx_in.product_id

    # Log in StockMovement
    notes_movement = f"EDIT Cereal Tx {tx_id}: {new_weight} {tx_in.unit} @ ₹{tx_in.rate}"
    if tx_in.bags:
        notes_movement += f" ({tx_in.bags} Kattas/Bags)"
    if tx_in.notes:
        notes_movement += f" | {tx_in.notes}"

    db.add(StockMovement(
        product_id=tx_in.product_id,
        movement_type="ADJUSTMENT",
        quantity=new_weight_adjusted - old_weight_adjusted if tx_in.transaction_type == "BUY" else old_weight_adjusted - new_weight_adjusted,
        reference_type="CerealTransaction",
        notes=notes_movement
    ))

    db.commit()
    db.refresh(tx)
    return tx
