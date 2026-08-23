from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, SessionLocal
from .models import User, Category, Product
from .routes import auth, customers, products, transactions
from .services.auth import get_password_hash
from decimal import Decimal
from sqlalchemy import text

# Auto create tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Family Business Management System")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(customers.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")

@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        # Migrate any legacy users with NULL status to 'Active'
        db.execute(text("UPDATE users SET status = 'Active' WHERE status IS NULL OR status = ''"))
        db.commit()

        # Seed default admin user
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            db.add(User(
                username="admin",
                password_hash=get_password_hash("adminpass"),
                role="Admin",
                status="Active"
            ))
        else:
            # Force status to Active, Role to Admin, and password to 'adminpass'
            admin.status = "Active"
            admin.role = "Admin"
            admin.password_hash = get_password_hash("adminpass")
            db.commit()

        # Seed initial product categories
        default_categories = ["Grocery / Daily Needs", "Pooja Items", "Household", "Personal Care", "Other", "Cereals & Crops"]
        for name in default_categories:
            exists = db.query(Category).filter(Category.name == name).first()
            if not exists:
                db.add(Category(name=name))
        db.commit()

        # Seed default products
        default_products = [
            {"name": "General Grocery Item (सामान्य किराना)", "category": "Other", "price": 1.00, "unit": "piece", "code": "PROD-GENERAL"},
            {"name": "Sugar (चीनी)", "category": "Grocery / Daily Needs", "price": 45.00, "unit": "kg", "code": "PROD-00001"},
            {"name": "Mustard Oil (सरसों का तेल)", "category": "Grocery / Daily Needs", "price": 180.00, "unit": "litre", "code": "PROD-00002"},
            {"name": "Incense Sticks (अगरबत्ती)", "category": "Pooja Items", "price": 40.00, "unit": "packet", "code": "PROD-00003"},
            {"name": "Dishwash Bar (साबुन)", "category": "Household", "price": 20.00, "unit": "piece", "code": "PROD-00004"},
            {"name": "Toothpaste (कोलげて)", "category": "Personal Care", "price": 65.00, "unit": "piece", "code": "PROD-00005"},
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
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"status": "healthy", "service": "Family Business Management System API"}

from .services.auth import verify_password
@app.get("/api/debug/admin")
def debug_admin():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            return {"status": "error", "message": "Admin user not found in database"}
        
        verifies = verify_password("adminpass", admin.password_hash)
        return {
            "status": "success",
            "username": admin.username,
            "role": admin.role,
            "user_status": admin.status,
            "password_hash": admin.password_hash,
            "verifies_correctly": verifies
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        db.close()
