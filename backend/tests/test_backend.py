import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from decimal import Decimal
from datetime import datetime

from backend.app.database import Base
from backend.app.models.user import User
from backend.app.models.customer import Customer
from backend.app.models.product import Category, Product
from backend.app.models.transaction import Sale, SaleItem, CustomerPayment, Expense
from backend.app.models.inventory import StockMovement
from backend.app.services.auth import get_password_hash, verify_password
from backend.app.services.customer_import import parse_csv_for_preview

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

def test_user_creation(db):
    hashed_pwd = get_password_hash("testpass")
    user = User(username="testuser", password_hash=hashed_pwd, role="Staff")
    db.add(user)
    db.commit()

    db_user = db.query(User).filter(User.username == "testuser").first()
    assert db_user is not None
    assert db_user.role == "Staff"
    assert verify_password("testpass", db_user.password_hash)

def test_customer_opening_balance(db):
    cust = Customer(
        customer_code="CUST-00001",
        name="Ramesh Kumar",
        opening_balance=Decimal("7500.00"),
        current_balance=Decimal("7500.00"),
        payment_type="Monthly Credit"
    )
    db.add(cust)
    db.commit()

    db_cust = db.query(Customer).filter(Customer.name == "Ramesh Kumar").first()
    assert db_cust.current_balance == Decimal("7500.00")

def test_customer_import_deduplication(db):
    # Seed DB with an existing customer
    existing = Customer(
        customer_code="CUST-00001",
        name="Ramesh Kumar",
        mobile="9876543210",
        opening_balance=Decimal("0.00"),
        current_balance=Decimal("0.00")
    )
    db.add(existing)
    db.commit()

    # CSV data bytes simulating a file upload containing duplicate constraints
    csv_data = (
        "Customer Name,Mobile,Address,Customer Type,Payment Type,Opening Balance,Credit Limit,Notes\n"
        "Ramesh Kumar,9876543210,123 Main St,Retail,Monthly Credit,7500,15000,Duplicate in DB\n"
        "Suresh Sharma,9823456789,456 Park Rd,Wholesale,Monthly Credit,12000,50000,New customer\n"
        "Suresh Sharma,9823456789,456 Park Road,Wholesale,Monthly Credit,2000,50000,CSV Internal duplicate\n"
    ).encode("utf-8")

    preview = parse_csv_for_preview(csv_data, db)
    assert preview.total_rows == 3
    assert preview.duplicate_count == 2  # Ramesh (DB duplicate) and 2nd Suresh (internal duplicate)
    assert preview.valid_count == 1      # 1st Suresh is valid

    assert preview.rows[0].is_duplicate is True
    assert "matches database customer" in preview.rows[0].duplicate_reason

    assert preview.rows[1].is_duplicate is False

    assert preview.rows[2].is_duplicate is True
    assert "duplicate of row 2 in CSV" in preview.rows[2].duplicate_reason

def test_sale_and_payment_updates_ledger(db):
    cust = Customer(
        customer_code="CUST-00001",
        name="Ramesh Kumar",
        opening_balance=Decimal("5000.00"),
        current_balance=Decimal("5000.00"),
        payment_type="Monthly Credit"
    )
    db.add(cust)

    cat = Category(name="Grocery")
    db.add(cat)
    db.flush()

    prod = Product(
        product_code="PROD-00001",
        name="Rice 5kg",
        category_id=cat.id,
        purchase_price=Decimal("100.00"),
        selling_price=Decimal("120.00"),
        current_stock=Decimal("10.00")
    )
    db.add(prod)
    db.commit()

    # Credit Sale: total ₹240.00. Customer pays ₹100.00 immediately. Remaining due ₹140.00
    sale = Sale(
        sale_number="SALE-00001",
        customer_id=cust.id,
        subtotal=Decimal("240.00"),
        discount=Decimal("0.00"),
        total_amount=Decimal("240.00"),
        paid_amount=Decimal("100.00"),
        due_amount=Decimal("140.00"),
        payment_method="Credit",
        payment_status="PARTIALLY PAID"
    )
    db.add(sale)

    prod.current_stock -= 2
    db.add(StockMovement(
        product_id=prod.id,
        movement_type="SALE",
        quantity=-2,
        reference_id=1,
        reference_type="Sale"
    ))

    # Single Entry logic: Update Customer balance by remaining due amount
    cust.current_balance += Decimal("140.00")
    db.commit()

    assert cust.current_balance == Decimal("5140.00")
    assert prod.current_stock == Decimal("8.00")

    # Payment: Customer pays ₹150.00 later
    payment = CustomerPayment(
        payment_number="PMT-00001",
        customer_id=cust.id,
        amount=Decimal("150.00"),
        payment_method="UPI"
    )
    db.add(payment)
    cust.current_balance -= Decimal("150.00")
    db.commit()

    # Final outstanding balance check: 5000 + 140 - 150 = 4990
    assert cust.current_balance == Decimal("4990.00")

def test_product_crud_and_void(db):
    try:
        # Setup test data
        cust = Customer(
            customer_code="CUST-999",
            name="Aman Gupta",
            payment_type="Monthly Credit",
            opening_balance=Decimal("0.00"),
            current_balance=Decimal("0.00")
        )
        db.add(cust)
        
        cat = Category(name="Test Spices")
        db.add(cat)
        db.flush()

        prod = Product(
            product_code="PROD-999",
            name="Cumin Seeds 100g",
            category_id=cat.id,
            purchase_price=Decimal("40.00"),
            selling_price=Decimal("50.00"),
            current_stock=Decimal("100.00")
        )
        db.add(prod)
        db.commit()

        # Update Cumin Seeds details
        prod.selling_price = Decimal("55.00")
        prod.brand = "Catch"
        db.commit()

        assert prod.selling_price == Decimal("55.00")
        assert prod.brand == "Catch"

        # Create credit sale of 10 packets of Cumin Seeds. Total ₹550.00. Paid ₹150.00 immediately. Due ₹400.00.
        sale = Sale(
            sale_number="SALE-999",
            customer_id=cust.id,
            subtotal=Decimal("550.00"),
            discount=Decimal("0.00"),
            total_amount=Decimal("550.00"),
            paid_amount=Decimal("150.00"),
            due_amount=Decimal("400.00"),
            payment_method="Credit",
            payment_status="PARTIALLY PAID",
            status="Active"
        )
        db.add(sale)
        
        # Deduct stock
        prod.current_stock -= 10
        db.add(StockMovement(
            product_id=prod.id,
            movement_type="SALE",
            quantity=-10,
            reference_id=sale.id,
            reference_type="Sale"
        ))
        
        # Add to customer outstanding due
        cust.current_balance += Decimal("400.00")
        db.commit()

        # Check values
        assert cust.current_balance == Decimal("400.00")
        assert prod.current_stock == Decimal("90.00")

        # Void (Cancel) the Sale
        sale.status = "Cancelled"
        # Restore stock
        prod.current_stock += 10
        db.add(StockMovement(
            product_id=prod.id,
            movement_type="CANCEL_SALE",
            quantity=10,
            reference_id=sale.id,
            reference_type="Sale"
        ))
        # Subtract due_amount from customer outstanding due
        cust.current_balance -= sale.due_amount
        db.commit()

        # Outstanding and stock should be restored!
        assert cust.current_balance == Decimal("0.00")
        assert prod.current_stock == Decimal("100.00")

    except Exception as e:
        db.rollback()
        raise e

def test_expense_and_user_management(db):
    try:
        # Create a new user (Staff member)
        staff = User(
            username="staff_ramesh",
            password_hash="hashedpass",
            role="Staff",
            status="Active"
        )
        db.add(staff)
        db.commit()

        # Query user
        db_staff = db.query(User).filter(User.username == "staff_ramesh").first()
        assert db_staff is not None
        assert db_staff.role == "Staff"

        # Soft deactivate user
        db_staff.status = "Inactive"
        db.commit()
        assert db_staff.status == "Inactive"

        # Re-register staff member (simulate registration database logic)
        existing = db.query(User).filter(User.username == "staff_ramesh").first()
        assert existing is not None
        if existing.status == "Inactive":
            existing.status = "Active"
            existing.role = "Admin"
            db.commit()
        
        re_registered = db.query(User).filter(User.username == "staff_ramesh").first()
        assert re_registered.status == "Active"
        assert re_registered.role == "Admin"

        # Add Expense
        expense = Expense(
            category="Electricity (बिजली बिल)",
            amount=Decimal("1500.50"),
            payment_method="UPI",
            description="July electricity bill payment"
        )
        db.add(expense)
        db.commit()

        # Query Expense
        db_exp = db.query(Expense).filter(Expense.category == "Electricity (बिजली बिल)").first()
        assert db_exp is not None
        assert db_exp.amount == Decimal("1500.50")
        assert db_exp.payment_method == "UPI"

        # Delete Expense
        db.delete(db_exp)
        db.commit()
        
        db_exp_deleted = db.query(Expense).filter(Expense.category == "Electricity (बिजली बिल)").first()
        assert db_exp_deleted is None

    except Exception as e:
        db.rollback()
        raise e
