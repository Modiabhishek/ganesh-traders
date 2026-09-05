from decimal import Decimal
from sqlalchemy.orm import Session
from ..models.customer import Customer
from ..models.transaction import Sale, CustomerPayment

def sync_customer_sales_and_payments(customer_id: int, db: Session):
    """
    Synchronizes customer's sales and payments:
    1. Allocates active CustomerPayment records to settle open credit sales in chronological order (FIFO).
    2. Updates each sale's paid_amount, due_amount, and payment_status so sales in the sales list reflect actual payment.
    3. Recalculates customer's balance as:
       opening_balance + total_active_sales - total_counter_paid - total_customer_payments.
    """
    if not customer_id:
        return

    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return

    # All active sales for this customer ordered chronologically
    sales = (
        db.query(Sale)
        .filter(Sale.customer_id == customer_id, Sale.status == "Active")
        .order_by(Sale.sale_date.asc(), Sale.id.asc())
        .all()
    )

    # All active customer payments for this customer
    payments = (
        db.query(CustomerPayment)
        .filter(CustomerPayment.customer_id == customer_id, CustomerPayment.status == "Active")
        .order_by(CustomerPayment.payment_date.asc(), CustomerPayment.id.asc())
        .all()
    )
    total_customer_payments = sum((Decimal(str(p.amount)) for p in payments), Decimal("0.00"))

    available_payment = total_customer_payments
    total_sales_amount = Decimal("0.00")
    total_counter_paid = Decimal("0.00")

    for s in sales:
        s_total = Decimal(str(s.total_amount))
        total_sales_amount += s_total

        # counter_paid: amount paid at counter at the time of sale
        c_paid = s.counter_paid
        if c_paid is None:
            if s.payment_method == "Credit":
                c_paid = Decimal("0.00")
            elif s.due_amount <= Decimal("0.00"):
                c_paid = s_total
            else:
                c_paid = Decimal(str(s.paid_amount))
            s.counter_paid = c_paid
        else:
            c_paid = Decimal(str(c_paid))

        total_counter_paid += c_paid

        # Remaining due on this sale after initial counter payment
        sale_base_due = max(Decimal("0.00"), s_total - c_paid)

        # Allocate from available customer payments
        allocated = min(available_payment, sale_base_due)
        available_payment -= allocated

        # Update sale paid and due amounts
        s.paid_amount = c_paid + allocated
        s.due_amount = max(Decimal("0.00"), sale_base_due - allocated)

        if s.due_amount <= Decimal("0.00"):
            s.payment_status = "PAID"
        elif s.paid_amount > Decimal("0.00"):
            s.payment_status = "PARTIALLY PAID"
        else:
            s.payment_status = "DUE"

    # Recalculate true current balance
    opening = Decimal(str(customer.opening_balance or "0.00"))
    customer.current_balance = opening + total_sales_amount - total_counter_paid - total_customer_payments
