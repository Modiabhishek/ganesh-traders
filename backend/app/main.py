from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, SessionLocal
from .models import User, Category, Product
from .models.customer import Customer
from .routes import auth, customers, products, transactions, backup
from .services.auth import get_password_hash
from decimal import Decimal
from sqlalchemy import text

# Auto create tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Family Business Management System")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ganesh-traders.modi.app",
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_origin_regex=r"^https://.*\.vercel\.app$|^https://.*\.netlify\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(customers.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(backup.router, prefix="/api")

@app.on_event("startup")
def startup_event():
    print("Startup: Initializing database connection...")
    try:
        db = SessionLocal()
    except Exception as e:
        print("Startup: Could not establish initial DB session:", e)
        return

    try:
        # 1. Create tables if missing
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            print("Startup: Base.metadata.create_all warning:", e)

        # 2. Migrate legacy users status
        try:
            db.execute(text("UPDATE users SET status = 'Active' WHERE status IS NULL OR status = ''"))
            db.commit()
        except Exception as e:
            db.rollback()
            print("Startup: Legacy users status migration warning:", e)

        # 3. Customer portal & product migrations
        for col_def in [
            "ALTER TABLE customers ADD COLUMN portal_username VARCHAR",
            "ALTER TABLE customers ADD COLUMN portal_password_hash VARCHAR",
            "ALTER TABLE customers ADD COLUMN portal_status VARCHAR DEFAULT 'Blocked'",
            "ALTER TABLE customers ADD COLUMN fathers_name VARCHAR",
            "ALTER TABLE customers ADD COLUMN reference VARCHAR",
            "ALTER TABLE products ADD COLUMN barcode VARCHAR",
        ]:
            try:
                db.execute(text(col_def))
                db.commit()
            except Exception:
                db.rollback()

        # 4. Seed initial Live Updates announcement
        try:
            from .models.customer import LiveUpdate
            exists_update = db.query(LiveUpdate).first()
            if not exists_update:
                db.add(LiveUpdate(
                    title="Welcome to Ganesh Traders Portal!",
                    content="Dear valued customers, we have launched our online portal where you can check your live dues, view ledger history, and see current crop rates. Thank you for your continued partnership!"
                ))
                db.commit()
        except Exception as e:
            db.rollback()
            print("Startup: LiveUpdate seeding warning:", e)

        # 5. Seed default admin user only if no Admin exists in the database
        try:
            admin_exists = db.query(User).filter(User.role == "Admin").first()
            if not admin_exists:
                db.add(User(
                    username="admin",
                    password_hash=get_password_hash("adminpass"),
                    role="Admin",
                    status="Active"
                ))
                db.commit()
        except Exception as e:
            db.rollback()
            print("Startup: Admin seeding warning:", e)

        # 6. Inactive customer cleanup
        try:
            inactive_custs = db.query(Customer).filter(Customer.status == "Inactive").all()
            for ic in inactive_custs:
                changed = False
                if ic.portal_username:
                    ic.portal_username = None
                    changed = True
                if ic.mobile and "_deleted_" not in ic.mobile:
                    import time
                    ic.mobile = f"{ic.mobile}_deleted_{int(time.time())}"
                    changed = True
                if changed:
                    db.add(ic)
            if inactive_custs:
                db.commit()
        except Exception as e:
            db.rollback()
            print("Startup: Inactive customer cleanup warning:", e)

        # 7. Seed categories & products
        try:
            default_categories = ["Grocery / Daily Needs", "Pooja Items", "Household", "Personal Care", "Other", "Cereals & Crops"]
            for name in default_categories:
                exists = db.query(Category).filter(Category.name == name).first()
                if not exists:
                    db.add(Category(name=name))
            db.commit()

            default_products = [
                {"name": "General Grocery Item (सामान्य किराना)", "category": "Other", "price": 1.00, "unit": "piece", "code": "PROD-GENERAL"},
                {"name": "Sugar (चीनी)", "category": "Grocery / Daily Needs", "price": 45.00, "unit": "kg", "code": "PROD-00001"},
                {"name": "Mustard Oil (सरसों का तेल)", "category": "Grocery / Daily Needs", "price": 180.00, "unit": "litre", "code": "PROD-00002"},
                {"name": "Incense Sticks (अगरबत्ती)", "category": "Pooja Items", "price": 40.00, "unit": "packet", "code": "PROD-00003"},
                {"name": "Dishwash Bar (साबुन)", "category": "Household", "price": 20.00, "unit": "piece", "code": "PROD-00004"},
                {"name": "Toothpaste (कोलगेट)", "category": "Personal Care", "price": 65.00, "unit": "piece", "code": "PROD-00005"},
                {"name": "Wheat (Gehu / गेहूँ)", "category": "Cereals & Crops", "price": 2400.00, "unit": "quintal", "code": "CEREAL-WHEAT"},
                {"name": "Chana (Bengal Gram / चना)", "category": "Cereals & Crops", "price": 5800.00, "unit": "quintal", "code": "CEREAL-CHANA"},
                {"name": "Bajra (Pearl Millet / बाजरा)", "category": "Cereals & Crops", "price": 2100.00, "unit": "quintal", "code": "CEREAL-BAJRA"},
                {"name": "Guar Seed (ग्वार)", "category": "Cereals & Crops", "price": 5200.00, "unit": "quintal", "code": "CEREAL-GUAR"},
                {"name": "Mustard (Sarsoo / सरसों)", "category": "Cereals & Crops", "price": 5650.00, "unit": "quintal", "code": "CEREAL-MUSTARD"},
            ]
            for p in default_products:
                prod_exists = db.query(Product).filter(Product.product_code == p["code"]).first()
                if not prod_exists:
                    cat = db.query(Category).filter(Category.name == p["category"]).first()
                    if cat:
                        db.add(Product(
                            product_code=p["code"],
                            name=p["name"],
                            category_id=cat.id,
                            selling_price=Decimal(str(p["price"])),
                            unit=p["unit"],
                            current_stock=Decimal("0.00") if p["code"].startswith("CEREAL") else Decimal("10000.00")
                        ))
            db.commit()
        except Exception as e:
            db.rollback()
            print("Startup: Categories & Products seeding warning:", e)

    except Exception as e:
        print("Startup: Unexpected error during startup:", e)
    finally:
        try:
            db.close()
        except Exception:
            pass
    print("Startup: Completed successfully.")

@app.get("/")
def read_root():
    return {"status": "healthy", "service": "Ganesh Traders Business API"}

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Ganesh Traders Business API"}

@app.get("/api/health")
def api_health_check():
    return {"status": "ok", "service": "Ganesh Traders Business API"}

