import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from decimal import Decimal

from backend.app.database import Base
from backend.app.models.user import User
from backend.app.models.customer import Customer
from backend.app.models.product import Category, Product
from backend.app.models.transaction import Sale, SaleItem, CustomerPayment
from backend.app.models.bill import Bill, BillItem, BillPayment, FinancialYearCounter
from backend.app.models.inventory import StockMovement
from backend.app.routes.transactions import (
    generate_sale_number, generate_payment_number, permanently_delete_sale_record, permanently_delete_payment_record
)
from backend.app.routes.bills import get_next_bill_number, permanently_delete_bill_record
from backend.app.services.customer_sync import sync_customer_sales_and_payments

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)

def test_sale_number_reuse_and_restart(db):
    # 1. First sale should be SALE-00001
    s1_num = generate_sale_number(db)
    assert s1_num == "SALE-00001"
    s1 = Sale(sale_number=s1_num, total_amount=Decimal("100.00"), paid_amount=Decimal("100.00"), due_amount=Decimal("0.00"))
    db.add(s1)
    db.commit()

    # 2. Second sale should be SALE-00002
    s2_num = generate_sale_number(db)
    assert s2_num == "SALE-00002"
    s2 = Sale(sale_number=s2_num, total_amount=Decimal("200.00"), paid_amount=Decimal("200.00"), due_amount=Decimal("0.00"))
    db.add(s2)
    db.commit()

    # 3. Third sale should be SALE-00003
    s3_num = generate_sale_number(db)
    assert s3_num == "SALE-00003"
    s3 = Sale(sale_number=s3_num, total_amount=Decimal("300.00"), paid_amount=Decimal("300.00"), due_amount=Decimal("0.00"))
    db.add(s3)
    db.commit()

    # 4. Delete SALE-00002 -> next generated sale should reuse SALE-00002
    permanently_delete_sale_record(s2.id, db)
    assert db.query(Sale).filter(Sale.sale_number == "SALE-00002").first() is None

    reused_num = generate_sale_number(db)
    assert reused_num == "SALE-00002"

    # Fill the gap with SALE-00002
    s2_new = Sale(sale_number=reused_num, total_amount=Decimal("200.00"), paid_amount=Decimal("200.00"), due_amount=Decimal("0.00"))
    db.add(s2_new)
    db.commit()

    # Next sale is SALE-00004
    assert generate_sale_number(db) == "SALE-00004"

    # 5. Delete all sales -> next sale should restart from SALE-00001
    permanently_delete_sale_record(s1.id, db)
    permanently_delete_sale_record(s2_new.id, db)
    permanently_delete_sale_record(s3.id, db)
    assert db.query(Sale).count() == 0

    restarted_num = generate_sale_number(db)
    assert restarted_num == "SALE-00001"

def test_permanent_sale_deletion_restores_stock_and_customer_balance(db):
    # Setup customer and product
    cust = Customer(customer_code="CUST-001", name="Test Customer", opening_balance=Decimal("0.00"), current_balance=Decimal("0.00"))
    db.add(cust)
    cat = Category(name="General")
    db.add(cat)
    db.flush()

    prod = Product(product_code="PROD-001", name="Test Item", category_id=cat.id, selling_price=Decimal("50.00"), current_stock=Decimal("100.00"))
    db.add(prod)
    db.commit()

    # Create credit sale of 5 items @ 50 = 250 (unpaid)
    sale = Sale(
        sale_number="SALE-00001",
        customer_id=cust.id,
        subtotal=Decimal("250.00"),
        total_amount=Decimal("250.00"),
        counter_paid=Decimal("0.00"),
        paid_amount=Decimal("0.00"),
        due_amount=Decimal("250.00"),
        payment_method="Credit",
        payment_status="DUE",
        status="Active"
    )
    db.add(sale)
    db.flush()

    item = SaleItem(sale_id=sale.id, product_id=prod.id, quantity=Decimal("5.00"), price=Decimal("50.00"), total=Decimal("250.00"))
    db.add(item)
    prod.current_stock -= Decimal("5.00")
    db.commit()

    sync_customer_sales_and_payments(cust.id, db)
    db.commit()

    # Stock is 95, customer balance is 250
    db.refresh(prod)
    db.refresh(cust)
    assert prod.current_stock == Decimal("95.00")
    assert cust.current_balance == Decimal("250.00")

    # Permanently delete the sale
    permanently_delete_sale_record(sale.id, db)

    # Verify permanent delete: record is gone
    assert db.query(Sale).filter(Sale.id == sale.id).first() is None
    assert db.query(SaleItem).filter(SaleItem.sale_id == sale.id).first() is None

    # Stock restored to 100, customer balance restored to 0
    db.refresh(prod)
    db.refresh(cust)
    assert prod.current_stock == Decimal("100.00")
    assert cust.current_balance == Decimal("0.00")

def test_pos_bill_reuse_and_restart(db):
    b1_no, fy = get_next_bill_number(db)
    short_fy = fy.split("-")[0][-2:] + "-" + fy.split("-")[1][-2:]
    expected_b1 = f"GT/{short_fy}/0001"
    assert b1_no == expected_b1

    # Create Bill and matching Sale
    bill1 = Bill(bill_no=b1_no, financial_year=fy, grand_total_paise=50000, status="Active")
    db.add(bill1)
    sale1 = Sale(sale_number=b1_no, total_amount=Decimal("500.00"), status="Active")
    db.add(sale1)
    db.commit()

    # Next bill is 0002
    b2_no, _ = get_next_bill_number(db)
    assert b2_no == f"GT/{short_fy}/0002"

    bill2 = Bill(bill_no=b2_no, financial_year=fy, grand_total_paise=30000, status="Active")
    db.add(bill2)
    sale2 = Sale(sale_number=b2_no, total_amount=Decimal("300.00"), status="Active")
    db.add(sale2)
    db.commit()

    # Delete Bill 2
    permanently_delete_bill_record(bill2.id, db)
    assert db.query(Bill).filter(Bill.bill_no == f"GT/{short_fy}/0002").first() is None
    assert db.query(Sale).filter(Sale.sale_number == f"GT/{short_fy}/0002").first() is None

    # Next bill should reuse 0002
    b2_reused, _ = get_next_bill_number(db)
    assert b2_reused == f"GT/{short_fy}/0002"

    # Delete Bill 1 as well
    permanently_delete_bill_record(bill1.id, db)
    assert db.query(Bill).count() == 0

    # Next bill should restart at 0001
    b1_restarted, _ = get_next_bill_number(db)
    assert b1_restarted == f"GT/{short_fy}/0001"

def test_payment_number_reuse(db):
    cust = Customer(customer_code="CUST-002", name="Test Customer 2", opening_balance=Decimal("0.00"), current_balance=Decimal("0.00"))
    db.add(cust)
    db.commit()

    p1_no = generate_payment_number(db)
    assert p1_no == "PMT-00001"
    p1 = CustomerPayment(payment_number=p1_no, customer_id=cust.id, amount=Decimal("100.00"), status="Active")
    db.add(p1)
    db.commit()

    p2_no = generate_payment_number(db)
    assert p2_no == "PMT-00002"

    # Delete p1
    permanently_delete_payment_record(p1.id, db)
    assert db.query(CustomerPayment).count() == 0

    # Next payment should reuse PMT-00001
    p1_reused = generate_payment_number(db)
    assert p1_reused == "PMT-00001"
